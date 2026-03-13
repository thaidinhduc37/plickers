from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.deps import get_current_user_or_auto
from app.schemas.schemas import ContestantOut, ContestantStatusUpdate
from app.models.models import ContestantStatus
from app.services import contestant_service, session_service
from app.ws.manager import ws_manager
from app.services.contestant_service import delete_contestant

router = APIRouter(prefix="/api/contestants", tags=["Contestants"])
auth = Depends(get_current_user_or_auto)


@router.post("/import/{contest_id}", response_model=List[ContestantOut])
async def import_contestants(
    contest_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=auth
):
    """
    Import danh sách người chơi từ file text/CSV.
    - Text thuần: mỗi dòng = 1 tên, card_id tự động tăng
    - CSV: name,card_id (2 cột)
    """
    content = (await file.read()).decode("utf-8")
    return contestant_service.import_contestants_csv(db, content, contest_id)


@router.get("", response_model=List[ContestantOut])
def get_contestants(
    contest_id: Optional[int] = Query(None),
    status: Optional[ContestantStatus] = Query(None),
    db: Session = Depends(get_db),
    _=auth
):
    return contestant_service.get_contestants(db, contest_id=contest_id, status=status)


@router.patch("/{contestant_id}/status", response_model=ContestantOut)
async def update_status(
    contestant_id: int,
    data: ContestantStatusUpdate,
    db: Session = Depends(get_db),
    _=auth
):
    """BTC override thủ công trạng thái người chơi."""
    # Lấy session hiện tại để biết câu mấy
    try:
        info = session_service.get_active_session_info(db)
        q_index = info["current_question_index"]
        session_id = info["session_id"]
    except Exception:
        q_index = None
        session_id = None

    contestant = contestant_service.update_contestant_status(
        db, contestant_id, data.status, q_index
    )

    # Broadcast override event
    if session_id:
        await ws_manager.broadcast(session_id, "btc_override", {
            "contestant_id": contestant.id,
            "contestant_name": contestant.name,
            "card_id": contestant.card_id,
            "new_status": data.status,
            "note": data.note,
        })

    return contestant


@router.delete("/{contestant_id}", status_code=204)
def remove_contestant(contestant_id: int, db: Session = Depends(get_db), _=auth):
    """Xoá thí sinh khỏi DB."""
    delete_contestant(db, contestant_id)


@router.post("/reset/{contest_id}")
def reset_contestants(contest_id: int, db: Session = Depends(get_db), _=auth):
    """Reset toàn bộ thí sinh của cuộc thi về trạng thái active."""
    from app.services.contestant_service import reset_contestants_for_session
    reset_contestants_for_session(db, contest_id)
    return {"reset": True}
