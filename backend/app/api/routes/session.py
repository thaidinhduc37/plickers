from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import SessionStartRequest, SessionOut, ActiveSessionResponse
from app.services import session_service
from app.ws.manager import ws_manager

router = APIRouter(prefix="/api/session", tags=["Session"])
auth = Depends(get_current_user)


@router.post("/start", response_model=SessionOut)
async def start_session(req: SessionStartRequest, db: Session = Depends(get_db), _=auth):
    """Bắt đầu phiên thi mới — reset tất cả người chơi về active."""
    session = session_service.start_session(db, req.contest_id)

    # Lấy câu hỏi đầu tiên để broadcast
    info = session_service.get_active_session_info(db)
    q = info["current_question"]

    await ws_manager.broadcast(session.id, "session_started", {
        "session_id": session.id,
        "contest_id": session.contest_id,
        "total_questions": info["total_questions"],
        "active_contestants": info["active_contestants"],
    })

    await ws_manager.broadcast(session.id, "question_changed", {
        "question_index": 0,
        "question": {
            "id": q.id,
            "text": q.text,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "time_limit_sec": q.time_limit_sec,
        } if q else None
    })

    return session


@router.get("/active", response_model=ActiveSessionResponse)
def get_active(db: Session = Depends(get_db), _=auth):
    """Lấy trạng thái phiên đang chạy — dùng để sync lại khi app BTC reconnect."""
    return session_service.get_active_session_info(db)


@router.post("/reveal")
async def reveal_answer(db: Session = Depends(get_db), _=auth):
    """Hiện đáp án đúng + tự động loại người sai."""
    result, eliminated = session_service.reveal_answer(db)

    # Lấy session_id
    from app.models.models import Session as SessionModel, SessionState
    session = db.query(SessionModel).filter(
        SessionModel.state == SessionState.revealed
    ).first()

    if session:
        await ws_manager.broadcast(session.id, "answer_revealed", {
            "correct_answer": result["correct_answer"],
            "votes": result["votes"],
            "correct_count": result["correct_count"],
            "eliminated_count": result["eliminated_count"],
            "remaining_count": result["remaining_count"],
        })

        if eliminated:
            await ws_manager.broadcast(session.id, "contestants_eliminated", {
                "eliminated": [
                    {"id": c.id, "name": c.name, "card_id": c.card_id}
                    for c in eliminated
                ],
                "remaining_count": result["remaining_count"],
            })

    return result


@router.post("/next-question")
async def next_question(db: Session = Depends(get_db), _=auth):
    """Chuyển sang câu tiếp theo."""
    data = session_service.next_question(db)

    from app.models.models import Session as SessionModel, SessionState
    session = db.query(SessionModel).filter(
        SessionModel.state == SessionState.scanning
    ).first()

    if session:
        q = data["current_question"]
        await ws_manager.broadcast(session.id, "question_changed", {
            "question_index": data["current_question_index"],
            "total_questions": data["total_questions"],
            "active_contestants": data["active_contestants"],
            "question": {
                "id": q.id,
                "text": q.text,
                "option_a": q.option_a,
                "option_b": q.option_b,
                "option_c": q.option_c,
                "option_d": q.option_d,
                "time_limit_sec": q.time_limit_sec,
            } if q else None
        })

    return data


@router.post("/end")
async def end_session(db: Session = Depends(get_db), _=auth):
    """Kết thúc phiên thi — đánh dấu người còn lại là winner."""
    data = session_service.end_session(db)

    from app.models.models import Session as SessionModel, SessionState
    session = db.query(SessionModel).filter(SessionModel.id == data["session_id"]).first()

    if session:
        await ws_manager.broadcast(session.id, "session_ended", {
            "winners": [{"id": w.id, "name": w.name, "card_id": w.card_id}
                        for w in data["winners"]],
            "total_questions_played": data["total_questions_played"],
        })

    return {
        "session_id": data["session_id"],
        "ended_at": data["ended_at"],
        "winners": [{"id": w.id, "name": w.name, "card_id": w.card_id}
                    for w in data["winners"]],
        "total_questions_played": data["total_questions_played"],
    }


@router.get("/{session_id}/results")
def get_results(session_id: int, db: Session = Depends(get_db), _=auth):
    return session_service.get_current_results(db, session_id)


@router.get("/{session_id}/summary")
def get_summary(session_id: int, db: Session = Depends(get_db), _=auth):
    return session_service.get_session_summary(db, session_id)
