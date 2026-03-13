from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_or_auto
from app.schemas.schemas import ScanSubmit
from app.services import session_service
from app.ws.manager import ws_manager

router = APIRouter(prefix="/api/scan", tags=["Scan"])
auth = Depends(get_current_user_or_auto)


@router.post("/submit")
async def submit_scan(data: ScanSubmit, db: Session = Depends(get_db), _=auth):
    """
    CV Service gọi endpoint này sau khi quét được thẻ.
    Có thể gửi nhiều kết quả trong 1 request (batch từ 1 frame).

    Body:
    {
        "session_id": 1,
        "results": [
            {"card_id": 42, "answer": "A"},
            {"card_id": 17, "answer": "C"},
            ...
        ]
    }
    """
    # FIX #7: Try-catch để handle errors và return clear message
    try:
        processed, votes = session_service.submit_scan_results(
            db, data.session_id, data.results
        )
    except HTTPException:
        # Re-raise HTTPException với detail rõ ràng
        raise
    except Exception as e:
        # Handle other errors
        raise HTTPException(status_code=400, detail=f"Lỗi quét: {str(e)}")

    # Broadcast từng kết quả mới lên WebSocket
    new_results = [r for r in processed if r.get("is_new") and r.get("status") == "recorded"]
    for r in new_results:
        await ws_manager.broadcast(data.session_id, "answer_received", {
            "card_id": r["card_id"],
            "contestant_name": r["contestant_name"],
            "answer": r["answer"],
            "votes_snapshot": votes,
            "scanned_count": votes["total"],
        })
    
    # FIX #2: Broadcast khi contestant bị loại quét thẻ
    eliminated_scans = [r for r in processed if r.get("status") == "eliminated"]
    for r in eliminated_scans:
        await ws_manager.broadcast(data.session_id, "contestant_eliminated_scan", {
            "card_id": r["card_id"],
            "contestant_id": r.get("contestant_id"),
            "contestant_name": r.get("contestant_name"),
            "reason": r.get("reason"),
        })

    return {
        "processed": len(processed),
        "recorded": len(new_results),
        "skipped": len([r for r in processed if r.get("status") == "skipped"]),
        "eliminated_scans": len(eliminated_scans),
        "votes": votes,
    }


@router.get("/status/{session_id}")
def scan_status(session_id: str, db: Session = Depends(get_db), _=auth):  # str vì Session.id = String(6)
    """Tiến độ quét: X/Y người đã có đáp án."""
    return session_service.get_current_results(db, session_id)