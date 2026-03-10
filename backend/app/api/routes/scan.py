from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.schemas.schemas import ScanSubmit
from app.services import session_service
from app.ws.manager import ws_manager

router = APIRouter(prefix="/api/scan", tags=["Scan"])
auth = Depends(get_current_user)


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
    processed, votes = session_service.submit_scan_results(
        db, data.session_id, data.results
    )

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

    return {
        "processed": len(processed),
        "recorded": len(new_results),
        "skipped": len([r for r in processed if r.get("status") == "skipped"]),
        "votes": votes,
    }


@router.get("/status/{session_id}")
def scan_status(session_id: int, db: Session = Depends(get_db), _=auth):
    """Tiến độ quét: X/Y người đã có đáp án."""
    return session_service.get_current_results(db, session_id)
