from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Contestant
from app.services.card_service import generate_cards_pdf, generate_blank_cards_pdf

router = APIRouter(prefix="/api/cards", tags=["Cards"])
auth = Depends(get_current_user)


@router.get("/generate/blank")
def generate_blank(
    count: int = Query(50, ge=1, le=200),
    start_id: int = Query(1, ge=1),
    _=auth
):
    """Tạo PDF thẻ trắng (chưa gán tên) để in sẵn."""
    pdf_bytes = generate_blank_cards_pdf(count, start_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rcv-cards-{start_id}-{start_id+count-1}.pdf"}
    )


@router.get("/generate/contest/{contest_id}")
def generate_for_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    _=auth
):
    """Tạo PDF thẻ có tên người chơi từ danh sách đã import."""
    contestants = db.query(Contestant).filter(
        Contestant.contest_id == contest_id
    ).order_by(Contestant.card_id).all()

    if not contestants:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Cuộc thi chưa có người chơi nào")

    data = [(c.card_id, c.name) for c in contestants]
    pdf_bytes = generate_cards_pdf(data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rcv-contest-{contest_id}-cards.pdf"}
    )
