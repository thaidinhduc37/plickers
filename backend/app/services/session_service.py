from datetime import datetime
from typing import List, Optional, Tuple, Set
from sqlalchemy.orm import Session as DBSession
from fastapi import HTTPException
import sqlalchemy

from app.models.models import (
    Session, Contest, Contestant, Response, SessionLog,
    SessionState, ContestantStatus, LogEventType, Question
)
from app.services.contestant_service import reset_contestants_for_session, reset_contestants_at_question

# ─── Application-level lock for SQLite compatibility ────────────────────────────
# FIX B7: with_for_update() is a no-op on SQLite, use threading.Lock as fallback
import threading
_reveal_lock = threading.Lock()
_skip_lock = threading.Lock()
_next_lock = threading.Lock()
_retry_lock = threading.Lock()


# ─── In-memory scanned-IDs store per session/round ─────────────────────────────
_session_scanned_ids: dict[str, Set[int]] = {}  # FIX #5: Track scanned IDs per round


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_active_session(db: DBSession) -> Session:
    s = db.query(Session).filter(
        Session.state.in_([SessionState.waiting, SessionState.scanning, SessionState.revealed])
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Không có phiên thi nào đang diễn ra")
    return s


def reset_scan_state(session_id: str):
    """Reset scanned IDs for new round (called on next/retry/skip question)"""
    _session_scanned_ids[session_id] = set()


def get_scanned_ids(session_id: str) -> Set[int]:
    """FIX #5: Get set of scanned card IDs for this session/round"""
    return _session_scanned_ids.get(session_id, set())


def add_scanned_id(session_id: str, card_id: int):
    """FIX #5: Mark card ID as scanned for this session/round"""
    if session_id not in _session_scanned_ids:
        _session_scanned_ids[session_id] = set()
    _session_scanned_ids[session_id].add(card_id)


def clear_scanned_ids(session_id: str):
    """FIX #5, #10: Clear scanned IDs for new round"""
    _session_scanned_ids[session_id] = set()


def _log(db: DBSession, session_id: str, event_type: LogEventType, data: dict = None):
    log = SessionLog(session_id=session_id, event_type=event_type, event_data=data or {})
    db.add(log)


def _get_main_questions(session: Session) -> list:
    """Get only main (non-backup) questions, sorted by order_index."""
    if not session.contest or not session.contest.bank or not session.contest.bank.questions:
        return []
    return sorted(
        [q for q in session.contest.bank.questions if not q.is_backup],
        key=lambda q: q.order_index
    )


def _get_current_question(session: Session) -> Optional[Question]:
    """Get the current question, respecting backup overrides."""
    if not session.contest or not session.contest.bank or not session.contest.bank.questions:
        return None
    
    # Check if there's a backup override for this index
    overrides = session.question_overrides or {}
    override_qid = overrides.get(str(session.current_question_index))
    if override_qid:
        for q in session.contest.bank.questions:
            if q.id == override_qid:
                return q
    
    # Normal: use main questions only
    main_qs = _get_main_questions(session)
    if session.current_question_index >= len(main_qs):
        return None
    return main_qs[session.current_question_index]


def _count_main_questions(session: Session) -> int:
    """Count only main (non-backup) questions."""
    return len(_get_main_questions(session))


def _count_active(db: DBSession, contest_id: int) -> int:
    return db.query(Contestant).filter(
        Contestant.contest_id == contest_id,
        Contestant.status == ContestantStatus.active
    ).count()


def _count_scanned(db: DBSession, session_id: str, question_id: int) -> int:
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
    
    # Kiểm tra có câu hỏi chính (không phải dự phòng)
    main_qs = [q for q in contest.bank.questions if not q.is_backup]
    if not main_qs:
        raise HTTPException(status_code=400, detail="Ngân hàng câu hỏi chưa có câu hỏi chính (chỉ có câu dự phòng)")

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
        state=SessionState.waiting,
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
    total_q = _count_main_questions(session)
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
        "used_backup_ids": session.used_backup_ids or [],
        "question_overrides": session.question_overrides or {},
    }


# ─── Submit Scan (từ CV Service) ──────────────────────────────────────────────

def submit_scan_results(
    db: DBSession,
    session_id: str,  # str vì Session.id là String(6) trong models.py
    results: List[dict]
) -> Tuple[List[dict], dict]:
    """
    Nhận batch kết quả quét từ CV Service.
    Trả về: (danh sách kết quả đã xử lý, vote_snapshot)
    
    BUG1 FIX: Bỏ scan_state gate — session.state là nguồn sự thật duy nhất.
    BUG5 FIX: Giữ session_id là str (Session.id = String(6), không phải int).
    FIX #5: Prevent duplicate detection per ID per round
    FIX #8, #9: Filter out eliminated contestants
    FIX #11: Validate ID range (1-100)
    FIX #12: Detect and handle duplicate card IDs
    """
    # BUG5 FIX: ép str để đảm bảo key dict nhất quán (session.id là String(6))
    session_id = str(session_id)

    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    if session.state != SessionState.scanning:
        # DIAGNOSTIC LOG: Log session state when rejection occurs
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"[DIAGNOSTIC] Submit scan rejected: session_id={session_id}, "
            f"current_state={session.state}, expected_state=scanning, "
            f"contest_id={session.contest_id}, current_question_index={session.current_question_index}"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{session.state}', không nhận đáp án"
        )

    # BUG1 FIX: Đã xóa scan_state gate (luôn WAITING vì không có endpoint set "scanning").
    # session.state == scanning từ DB là điều kiện đủ để nhận đáp án.

    current_q = _get_current_question(session)
    if not current_q:
        raise HTTPException(status_code=400, detail="Không có câu hỏi hiện tại")

    processed = []
    seen_card_ids: Set[int] = set()  # FIX #12: Track duplicates within this batch
    scanned_ids = get_scanned_ids(session_id)  # FIX #5: Get already scanned IDs

    for item in results:
        card_id = item.card_id if hasattr(item, "card_id") else item["card_id"]
        answer = (item.answer if hasattr(item, "answer") else item["answer"]).upper()

        # FIX #11: Validate ID range (1-100)
        if not isinstance(card_id, int) or card_id < 1 or card_id > 100:
            processed.append({
                "card_id": card_id,
                "status": "skipped",
                "reason": "ID ngoài phạm vi (1-100)"
            })
            continue

        # FIX #12: Detect duplicate card IDs in same batch
        if card_id in seen_card_ids:
            processed.append({
                "card_id": card_id,
                "status": "skipped",
                "reason": "Duplicate ID trong batch"
            })
            continue
        seen_card_ids.add(card_id)

        # FIX #5: Check if this card ID was already scanned in this round
        if card_id in scanned_ids:
            processed.append({
                "card_id": card_id,
                "status": "skipped",
                "reason": "Đã quét trong round này"
            })
            continue

        # FIX #2: Check contestant với tất cả trạng thái để phân biệt "eliminated" vs "not found"
        contestant = db.query(Contestant).filter(
            Contestant.card_id == card_id,
            Contestant.contest_id == session.contest_id
        ).first()

        if not contestant:
            processed.append({
                "card_id": card_id,
                "status": "skipped",
                "reason": "Không tìm thấy"
            })
            continue
        
        # FIX #8, #9: Nếu contestant đã bị loại, trả về status "eliminated" để notify
        if contestant.status != ContestantStatus.active:
            processed.append({
                "card_id": card_id,
                "status": "eliminated",
                "reason": f"Đã bị loại (trạng thái: {contestant.status})",
                "contestant_id": contestant.id,
                "contestant_name": contestant.name
            })
            continue

        # Mark as scanned for this round (FIX #5)
        add_scanned_id(session_id, card_id)

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
    
    FIX B7: Check SQLite and use application-level lock as fallback
    """
    # FIX B7: Check if using SQLite and warn/error
    if db.bind.dialect.name == "sqlite":
        # Use application-level lock for SQLite
        with _reveal_lock:
            return _reveal_answer_internal(db)
    else:
        # PostgreSQL - use row-level lock
        return _reveal_answer_internal(db)


def _reveal_answer_internal(db: DBSession) -> Tuple[dict, List[Contestant]]:
    """Internal implementation for reveal_answer"""
    # Lock session row với condition check
    session = db.query(Session).filter(
        Session.state == SessionState.scanning
    ).with_for_update().first()  # PostgreSQL row lock
    
    if not session:
        active = _get_active_session(db)
        if not active:
            raise HTTPException(status_code=404, detail="Không có phiên thi nào đang hoạt động")
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', phải ở trạng thái 'scanning' để reveal"
        )

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
        elif c.id in answered_correctly:
            c.correct_count = (c.correct_count or 0) + 1

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
    """
    Chuyển sang câu hỏi tiếp theo.
    
    FIX B7: Check SQLite and use application-level lock as fallback
    FIX #10: Reset scan state and cleared data for new round
    """
    # FIX B7: Check if using SQLite
    if db.bind.dialect.name == "sqlite":
        with _next_lock:
            return _next_question_internal(db)
    else:
        return _next_question_internal(db)


def _next_question_internal(db: DBSession) -> dict:
    """Internal implementation for next_question"""
    # Lock session row với condition check
    session = db.query(Session).filter(
        Session.state == SessionState.revealed
    ).with_for_update().first()  # PostgreSQL row lock
    
    if not session:
        active = _get_active_session(db)
        if not active:
            raise HTTPException(status_code=404, detail="Không có phiên thi nào đang hoạt động")
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', phải ở trạng thái 'revealed' để chuyển câu"
        )

    total = _count_main_questions(session)
    next_index = session.current_question_index + 1

    if next_index >= total:
        raise HTTPException(status_code=400, detail="Đã hết câu hỏi, hãy kết thúc phiên thi")
    session.current_question_index = next_index
    session.state = SessionState.scanning
    db.commit()
    db.refresh(session)

    # FIX #10: Reset scan state machine for new round
    reset_scan_state(session.id)

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


# ─── Retry Question ─────────────────────────────────────────────────────────────

def retry_question(db: DBSession) -> dict:
    """
    Thi lại câu hỏi hiện tại.
    - Khôi phục người chơi bị loại ở câu hiện tại.
    - Xóa responses của câu hiện tại.
    - Đặt lại state về scanning.
    
    FIX B7: Check SQLite and use application-level lock as fallback
    FIX #10: Reset scan state machine for retry
    """
    # FIX B7: Check if using SQLite
    if db.bind.dialect.name == "sqlite":
        with _retry_lock:
            return _retry_question_internal(db)
    else:
        return _retry_question_internal(db)


def _retry_question_internal(db: DBSession) -> dict:
    """Internal implementation for retry_question"""
    session = db.query(Session).filter(
        Session.state == SessionState.revealed
    ).with_for_update().first()
    
    if not session:
        active = _get_active_session(db)
        if not active:
            raise HTTPException(status_code=404, detail="Không có phiên thi nào đang hoạt động")
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', phải ở trạng thái 'revealed' để thi lại"
        )
    
    current_index = session.current_question_index
    
    # Decrement correct_count for contestants who answered correctly on this question
    current_q = _get_current_question(session)
    if current_q:
        correct_responses = db.query(Response).filter(
            Response.session_id == session.id,
            Response.question_id == current_q.id,
            Response.answer == current_q.correct_answer
        ).all()
        correct_ids = {r.contestant_id for r in correct_responses}
        if correct_ids:
            for c in db.query(Contestant).filter(Contestant.id.in_(correct_ids)).all():
                c.correct_count = max(0, (c.correct_count or 0) - 1)
    
    # Reset người chơi tại câu hiện tại
    restored_count = reset_contestants_at_question(db, session.contest_id, current_index)
    
    # Đặt lại state
    session.state = SessionState.scanning
    db.commit()
    
    # FIX #10: Reset scan state machine for retry
    reset_scan_state(session.id)
    
    _log(db, session.id, LogEventType.question_opened, {
        "question_index": current_index,
        "question_id": current_q.id if current_q else None,
        "action": "retry",
        "restored_contestants": restored_count
    })
    db.commit()
    
    return {
        "current_question_index": current_index,
        "total_questions": _count_main_questions(session),
        "current_question": current_q,
        "active_contestants": _count_active(db, session.contest_id),
        "restored_contestants": restored_count,
    }


# ─── Skip Question ─────────────────────────────────────────────────────────────

def skip_question(db: DBSession) -> dict:
    """
    Bỏ qua câu hỏi hiện tại (không tính điểm).
    - Chuyển sang câu tiếp theo.
    - Không loại ai.
    
    FIX B7: Check SQLite and use application-level lock as fallback
    """
    # FIX B7: Check if using SQLite
    if db.bind.dialect.name == "sqlite":
        with _skip_lock:
            return _skip_question_internal(db)
    else:
        return _skip_question_internal(db)


def _skip_question_internal(db: DBSession) -> dict:
    """Internal implementation for skip_question"""
    session = db.query(Session).filter(
        Session.state.in_([SessionState.scanning, SessionState.revealed])
    ).with_for_update().first()
    
    if not session:
        active = _get_active_session(db)
        if not active:
            raise HTTPException(status_code=404, detail="Không có phiên thi nào đang hoạt động")
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', phải ở trạng thái 'scanning' hoặc 'revealed' để bỏ qua"
        )
    
    total = _count_main_questions(session)
    next_index = session.current_question_index + 1
    
    if next_index >= total:
        raise HTTPException(status_code=400, detail="Đã hết câu hỏi")
    
    session.current_question_index = next_index
    session.state = SessionState.scanning
    db.commit()
    db.refresh(session)

    # Bug E fix: reset scanned IDs so cards from skipped question are accepted in next question
    reset_scan_state(session.id)

    current_q = _get_current_question(session)
    _log(db, session.id, LogEventType.question_opened, {
        "question_index": next_index,
        "question_id": current_q.id if current_q else None,
        "action": "skip"
    })
    db.commit()
    
    return {
        "current_question_index": next_index,
        "total_questions": total,
        "current_question": current_q,
        "active_contestants": _count_active(db, session.contest_id),
    }


# ─── Use Backup Question (Loại bỏ câu + thay bằng câu dự phòng) ─────────────
_backup_lock = threading.Lock()


def use_backup_question(db: DBSession, backup_question_id: int) -> dict:
    """
    Loại bỏ câu hiện tại, thay bằng câu dự phòng.
    - Khôi phục thí sinh bị loại ở câu hiện tại (nếu đã reveal)
    - Xoá responses của câu hiện tại
    - Ghi nhận override: câu hiện tại sẽ dùng backup question
    - Đánh dấu backup đã sử dụng
    """
    if db.bind.dialect.name == "sqlite":
        with _backup_lock:
            return _use_backup_question_internal(db, backup_question_id)
    else:
        return _use_backup_question_internal(db, backup_question_id)


def _use_backup_question_internal(db: DBSession, backup_question_id: int) -> dict:
    session = db.query(Session).filter(
        Session.state.in_([SessionState.scanning, SessionState.revealed])
    ).with_for_update().first()

    if not session:
        active = _get_active_session(db)
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', không thể thay câu dự phòng"
        )

    # Validate backup question
    backup_q = db.query(Question).filter(Question.id == backup_question_id).first()
    if not backup_q:
        raise HTTPException(status_code=404, detail="Câu dự phòng không tồn tại")
    if not backup_q.is_backup:
        raise HTTPException(status_code=400, detail="Câu này không phải câu dự phòng")

    # Check if already used
    used_ids = list(session.used_backup_ids or [])
    if backup_question_id in used_ids:
        raise HTTPException(status_code=400, detail="Câu dự phòng này đã được sử dụng")

    current_index = session.current_question_index
    current_q = _get_current_question(session)

    # Decrement correct_count for contestants who answered correctly on this question
    if current_q:
        correct_responses = db.query(Response).filter(
            Response.session_id == session.id,
            Response.question_id == current_q.id,
            Response.answer == current_q.correct_answer
        ).all()
        correct_ids = {r.contestant_id for r in correct_responses}
        if correct_ids:
            for c in db.query(Contestant).filter(Contestant.id.in_(correct_ids)).all():
                c.correct_count = max(0, (c.correct_count or 0) - 1)

    # Restore contestants eliminated at this question (if already revealed)
    if session.state == SessionState.revealed and current_q:
        restored_count = reset_contestants_at_question(db, session.contest_id, current_index)
    else:
        restored_count = 0

    # Delete responses for current question
    if current_q:
        db.query(Response).filter(
            Response.session_id == session.id,
            Response.question_id == current_q.id
        ).delete()

    # Record override
    overrides = dict(session.question_overrides or {})
    overrides[str(current_index)] = backup_question_id
    session.question_overrides = overrides

    # Mark backup as used
    used_ids.append(backup_question_id)
    session.used_backup_ids = used_ids

    # Reset to scanning state
    session.state = SessionState.scanning
    db.commit()
    db.refresh(session)

    reset_scan_state(session.id)

    new_q = _get_current_question(session)
    _log(db, session.id, LogEventType.question_opened, {
        "question_index": current_index,
        "question_id": new_q.id if new_q else None,
        "action": "use_backup",
        "backup_question_id": backup_question_id,
        "restored_contestants": restored_count,
    })
    db.commit()

    return {
        "current_question_index": current_index,
        "total_questions": _count_main_questions(session),
        "current_question": new_q,
        "active_contestants": _count_active(db, session.contest_id),
        "restored_contestants": restored_count,
        "used_backup_ids": session.used_backup_ids,
        "question_overrides": session.question_overrides,
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

def get_current_results(db: DBSession, session_id: str, reveal: bool = False) -> dict:
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


def get_session_summary(db: DBSession, session_id: str) -> dict:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    winners = db.query(Contestant).filter(
        Contestant.contest_id == session.contest_id,
        Contestant.status == ContestantStatus.winner
    ).all()

    # FIX B3: Use correct relationship - questions are in bank, not directly in contest
    per_question = []
    if session.contest and session.contest.bank:
        questions = sorted(session.contest.bank.questions, key=lambda x: x.order_index)
        for q in questions:
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