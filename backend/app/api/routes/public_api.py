from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.schemas import ActiveSessionResponse, ContestantOut, ScanSubmit
from app.services import session_service, contestant_service
from app.ws.manager import ws_manager

router = APIRouter(prefix="/api/public", tags=["Public Scanner"])

@router.get("/session/{session_id}", response_model=ActiveSessionResponse)
def get_public_session(session_id: int, db: Session = Depends(get_db)):
    """Lấy thông tin phiên thi theo ID (dùng cho điện thoại quét) không cần login."""
    try:
        info = session_service.get_active_session_info(db)
        if info["session_id"] != session_id:
            raise HTTPException(status_code=404, detail="Phiên thi đã kết thúc hoặc không đúng.")
        return info
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên thi hoặc đã kết thúc.")


@router.get("/session/{session_id}/contestants", response_model=List[ContestantOut])
def get_public_contestants(session_id: int, db: Session = Depends(get_db)):
    """Lấy danh sách thí sinh trong phiên thi."""
    try:
        info = session_service.get_active_session_info(db)
        if info["session_id"] != session_id:
            raise HTTPException(status_code=404, detail="Phiên thi không hợp lệ.")
        return contestant_service.get_contestants(db, contest_id=info["contest_id"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu.")


@router.post("/session/{session_id}/scan")
async def public_submit_scan(session_id: int, data: ScanSubmit, db: Session = Depends(get_db)):
    """Gửi kết quả quét từ điện thoại."""
    if data.session_id != session_id:
        raise HTTPException(status_code=400, detail="Sai ID phiên thi")

    processed, votes = session_service.submit_scan_results(
        db, data.session_id, data.results
    )

    # Broadcast
    new_results = [r for r in processed if r.get("is_new") and r.get("status") == "recorded"]
    for r in new_results:
        await ws_manager.broadcast(data.session_id, "answer_received", {
            "card_id": r["card_id"],
            "contestant_name": r["contestant_name"],
            "answer": r["answer"],
            "votes_snapshot": votes,
            "scanned_count": votes["total"],
        })

    return {
        "processed": len(processed),
        "recorded": len(new_results),
        "skipped": len([r for r in processed if r.get("status") == "skipped"]),
        "votes": votes,
    }

@router.post("/session/{session_id}/reveal")
async def public_reveal(session_id: str, db: Session = Depends(get_db)):
    """Cho phép MC bấm công khai từ điện thoại."""
    try:
        info = session_service.get_active_session_info(db)
        if info["session_id"] != session_id:
            raise HTTPException(status_code=400, detail="Sai ID phiên")
        
        result, eliminated = session_service.reveal_answer(db)
        
        from app.models.models import Session as SessionModel, SessionState
        session = db.query(SessionModel).filter(SessionModel.id == session_id).first()

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
                    "eliminated": [{"id": c.id, "name": c.name, "card_id": c.card_id} for c in eliminated],
                    "remaining_count": result["remaining_count"],
                })

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
