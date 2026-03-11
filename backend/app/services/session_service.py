from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session as DBSession
from fastapi import HTTPException

from app.models.models import (
    Session, Contest, Contestant, Response, SessionLog,
    SessionState, ContestantStatus, LogEventType, Question
)
from app.services.contestant_service import reset_contestants_for_session


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_active_session(db: DBSession) -> Session:
    s = db.query(Session).filter(
        Session.state.in_([SessionState.waiting, SessionState.scanning, SessionState.revealed])
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Không có phiên thi nào đang diễn ra")
    return s


def _log(db: DBSession, session_id: int, event_type: LogEventType, data: dict = None):
    log = SessionLog(session_id=session_id, event_type=event_type, event_data=data or {})
    db.add(log)


def _get_current_question(session: Session) -> Optional[Question]:
    if not session.contest or not session.contest.bank or not session.contest.bank.questions:
        return None
    questions = sorted(session.contest.bank.questions, key=lambda q: q.order_index)
    if session.current_question_index >= len(questions):
        return None
    return questions[session.current_question_index]


def _count_active(db: DBSession, contest_id: int) -> int:
    return db.query(Contestant).filter(
        Contestant.contest_id == contest_id,
        Contestant.status == ContestantStatus.active
    ).count()


def _count_scanned(db: DBSession, session_id: int, question_id: int) -> int:
    return db.query(Response).filter(
        Response.session_id == session_id,
        Response.question_id == question_id
    ).count()


# ─── Start Session ────────────────────────────────────────────────────────────

def start_session(db: DBSession, contest_id: int) -> Session:
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Cuộc thi không tồn tại")
    if not contest.bank or not contest.bank.questions:
        raise HTTPException(status_code=400, detail="Cuộc thi chưa chọn ngân hàng câu hỏi hoặc ngân hàng trống")

    # Đóng session cũ nếu còn
    old = db.query(Session).filter(
        Session.state != SessionState.ended
    ).all()
    for s in old:
        s.state = SessionState.ended
        s.ended_at = datetime.utcnow()

    # Reset trạng thái người chơi
    reset_contestants_for_session(db, contest_id)

    session = Session(
        contest_id=contest_id,
        state=SessionState.scanning,
        current_question_index=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    _log(db, session.id, LogEventType.session_started, {"contest_id": contest_id})
    _log(db, session.id, LogEventType.question_opened, {
        "question_index": 0,
        "question_id": _get_current_question(session).id if _get_current_question(session) else None
    })
    db.commit()
    return session


# ─── Get Active Session ───────────────────────────────────────────────────────

def get_active_session_info(db: DBSession) -> dict:
    session = _get_active_session(db)
    current_q = _get_current_question(session)
    total_q = len(session.contest.bank.questions) if session.contest.bank else 0
    active = _count_active(db, session.contest_id)
    scanned = _count_scanned(db, session.id, current_q.id) if current_q else 0

    return {
        "session_id": session.id,
        "contest_id": session.contest_id,
        "state": session.state,
        "current_question_index": session.current_question_index,
        "total_questions": total_q,
        "current_question": current_q,
        "active_contestants": active,
        "scanned_count": scanned,
    }


# ─── Submit Scan (từ CV Service) ──────────────────────────────────────────────

def submit_scan_results(
    db: DBSession,
    session_id: int,
    results: List[dict]
) -> Tuple[List[dict], dict]:
    """
    Nhận batch kết quả quét từ CV Service.
    Trả về: (danh sách kết quả đã xử lý, vote_snapshot)
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    if session.state != SessionState.scanning:
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{session.state}', không nhận đáp án"
        )

    current_q = _get_current_question(session)
    if not current_q:
        raise HTTPException(status_code=400, detail="Không có câu hỏi hiện tại")

    processed = []

    for item in results:
        card_id = item.card_id if hasattr(item, "card_id") else item["card_id"]
        answer = (item.answer if hasattr(item, "answer") else item["answer"]).upper()

        contestant = db.query(Contestant).filter(
            Contestant.card_id == card_id,
            Contestant.contest_id == session.contest_id,
            Contestant.status == ContestantStatus.active
        ).first()

        if not contestant:
            processed.append({
                "card_id": card_id,
                "status": "skipped",
                "reason": "Không tìm thấy hoặc đã bị loại"
            })
            continue

        # Upsert response
        existing = db.query(Response).filter(
            Response.session_id == session_id,
            Response.contestant_id == contestant.id,
            Response.question_id == current_q.id
        ).first()

        is_new = existing is None
        if existing:
            existing.answer = answer
            existing.scanned_at = datetime.utcnow()
        else:
            db.add(Response(
                session_id=session_id,
                contestant_id=contestant.id,
                question_id=current_q.id,
                answer=answer
            ))

        processed.append({
            "card_id": card_id,
            "contestant_id": contestant.id,
            "contestant_name": contestant.name,
            "answer": answer,
            "is_new": is_new,
            "status": "recorded"
        })

    db.commit()

    # Vote snapshot
    votes = {"A": 0, "B": 0, "C": 0, "D": 0}
    all_responses = db.query(Response).filter(
        Response.session_id == session_id,
        Response.question_id == current_q.id
    ).all()
    for r in all_responses:
        if r.answer in votes:
            votes[r.answer] += 1
    votes["total"] = sum(votes.values())

    return processed, votes


# ─── Reveal Answer ────────────────────────────────────────────────────────────

def reveal_answer(db: DBSession) -> Tuple[dict, List[Contestant]]:
    """
    Hiện đáp án đúng + tự động loại người trả lời sai.
    Trả về: (vote_result, danh sách bị loại)
    """
    session = _get_active_session(db)
    if session.state != SessionState.scanning:
        raise HTTPException(status_code=400, detail="Phải đang ở trạng thái 'scanning' để reveal")

    current_q = _get_current_question(session)
    if not current_q:
        raise HTTPException(status_code=400, detail="Không có câu hỏi hiện tại")

    session.state = SessionState.revealed
    db.commit()

    # Tìm người trả lời sai
    all_responses = db.query(Response).filter(
        Response.session_id == session.id,
        Response.question_id == current_q.id
    ).all()

    answered_correctly = {r.contestant_id for r in all_responses if r.answer == current_q.correct_answer}
    answered_wrongly = {r.contestant_id for r in all_responses if r.answer != current_q.correct_answer}

    # Tìm người không trả lời (coi như sai)
    active_contestants = db.query(Contestant).filter(
        Contestant.contest_id == session.contest_id,
        Contestant.status == ContestantStatus.active
    ).all()
    answered_ids = {r.contestant_id for r in all_responses}
    not_answered = {c.id for c in active_contestants if c.id not in answered_ids}

    # Tất cả bị loại = sai + không trả lời
    to_eliminate_ids = answered_wrongly | not_answered

    eliminated = []
    for c in active_contestants:
        if c.id in to_eliminate_ids:
            c.status = ContestantStatus.eliminated
            c.eliminated_at_question = session.current_question_index
            eliminated.append(c)

    db.commit()

    # Vote stats
    votes = {"A": 0, "B": 0, "C": 0, "D": 0}
    for r in all_responses:
        if r.answer in votes:
            votes[r.answer] += 1

    result = {
        "question_id": current_q.id,
        "correct_answer": current_q.correct_answer,
        "votes": votes,
        "total_answered": len(answered_ids),
        "correct_count": len(answered_correctly),
        "eliminated_count": len(eliminated),
        "remaining_count": _count_active(db, session.contest_id),
    }

    _log(db, session.id, LogEventType.answer_revealed, result)
    if eliminated:
        _log(db, session.id, LogEventType.contestants_eliminated, {
            "eliminated_ids": [c.id for c in eliminated],
            "question_index": session.current_question_index
        })
    db.commit()

    return result, eliminated


# ─── Next Question ────────────────────────────────────────────────────────────

def next_question(db: DBSession) -> dict:
    """Chuyển sang câu hỏi tiếp theo."""
    session = _get_active_session(db)
    if session.state != SessionState.revealed:
        raise HTTPException(status_code=400, detail="Phải reveal đáp án trước khi sang câu tiếp")

    total = len(session.contest.bank.questions) if session.contest.bank else 0
    next_index = session.current_question_index + 1

    if next_index >= total:
        raise HTTPException(status_code=400, detail="Đã hết câu hỏi, hãy kết thúc phiên thi")

    session.current_question_index = next_index
    session.state = SessionState.scanning
    db.commit()
    db.refresh(session)

    current_q = _get_current_question(session)
    _log(db, session.id, LogEventType.question_opened, {
        "question_index": next_index,
        "question_id": current_q.id if current_q else None
    })
    db.commit()

    return {
        "current_question_index": next_index,
        "total_questions": total,
        "current_question": current_q,
        "active_contestants": _count_active(db, session.contest_id),
    }


# ─── End Session ──────────────────────────────────────────────────────────────

def end_session(db: DBSession) -> dict:
    session = _get_active_session(db)
    session.state = SessionState.ended
    session.ended_at = datetime.utcnow()

    # Đánh dấu người còn lại là winner
    winners = db.query(Contestant).filter(
        Contestant.contest_id == session.contest_id,
        Contestant.status == ContestantStatus.active
    ).all()
    for w in winners:
        w.status = ContestantStatus.winner

    db.commit()

    _log(db, session.id, LogEventType.session_ended, {
        "winners": [{"id": w.id, "name": w.name, "card_id": w.card_id} for w in winners]
    })
    db.commit()

    return {
        "session_id": session.id,
        "ended_at": session.ended_at,
        "winners": winners,
        "total_questions_played": session.current_question_index + 1,
    }


# ─── Get Results ──────────────────────────────────────────────────────────────

def get_current_results(db: DBSession, session_id: int, reveal: bool = False) -> dict:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    current_q = _get_current_question(session)
    if not current_q:
        return {"error": "Không có câu hỏi hiện tại"}

    votes = {"A": 0, "B": 0, "C": 0, "D": 0}
    responses = db.query(Response).filter(
        Response.session_id == session_id,
        Response.question_id == current_q.id
    ).all()
    for r in responses:
        if r.answer in votes:
            votes[r.answer] += 1
    votes["total"] = sum(votes.values())

    eliminated_this_round = db.query(Contestant).filter(
        Contestant.contest_id == session.contest_id,
        Contestant.eliminated_at_question == session.current_question_index
    ).all() if session.state == SessionState.revealed else []

    return {
        "session_id": session_id,
        "question_id": current_q.id,
        "question_index": session.current_question_index,
        "correct_answer": current_q.correct_answer if session.state == SessionState.revealed else None,
        "votes": votes,
        "active_count": _count_active(db, session.contest_id),
        "scanned_count": len(responses),
        "eliminated_this_round": eliminated_this_round,
    }


def get_session_summary(db: DBSession, session_id: int) -> dict:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    winners = db.query(Contestant).filter(
        Contestant.contest_id == session.contest_id,
        Contestant.status == ContestantStatus.winner
    ).all()

    per_question = []
    for q in sorted(session.contest.questions, key=lambda x: x.order_index):
        responses = db.query(Response).filter(
            Response.session_id == session_id,
            Response.question_id == q.id
        ).all()
        votes = {"A": 0, "B": 0, "C": 0, "D": 0}
        for r in responses:
            if r.answer in votes:
                votes[r.answer] += 1
        per_question.append({
            "question_index": q.order_index,
            "question_text": q.text,
            "correct_answer": q.correct_answer,
            "votes": votes,
            "total_answered": len(responses),
        })

    return {
        "session_id": session_id,
        "contest_title": session.contest.title,
        "total_questions_played": session.current_question_index + 1,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "final_active_count": _count_active(db, session.contest_id),
        "winners": winners,
        "per_question": per_question,
    }
