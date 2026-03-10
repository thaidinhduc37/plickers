from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException
from app.models.models import Contestant, ContestantStatus
from typing import List, Optional
import csv
import io


def import_contestants_csv(db: Session, content: str, contest_id: int) -> List[Contestant]:
    """
    Import từ file CSV hoặc text thuần.
    Định dạng CSV: name,card_id  (có header hoặc không)
    Định dạng text: mỗi dòng là tên, card_id tự động tăng
    """
    lines = [l.strip() for l in content.strip().splitlines() if l.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="File trống")

    # Max card_id trong contest này để đảm bảo thẻ không trùng nhau
    max_card = db.query(func.max(Contestant.card_id)).filter(
        Contestant.contest_id == contest_id
    ).scalar() or 0
    next_id = max_card + 1   # counter tuần tự, tăng đều +1

    # Phát hiện xem có phải CSV có 2 cột không
    has_id_column = "," in lines[0] and not lines[0].lower().startswith("name")

    created = []
    for line in lines:
        if has_id_column:
            parts = line.split(",", 1)
            name = parts[0].strip()
            try:
                card_id = int(parts[1].strip())
            except (ValueError, IndexError):
                card_id = next_id
                next_id += 1
        else:
            name = line
            card_id = next_id
            next_id += 1

        # Chỉ check trùng card_id trong CÙNG contest — giữ thẻ unique per-contest
        existing = db.query(Contestant).filter(
            Contestant.card_id == card_id,
            Contestant.contest_id == contest_id
        ).first()
        if existing:
            continue

        contestant = Contestant(
            name=name,
            card_id=card_id,
            contest_id=contest_id,
            status=ContestantStatus.active
        )
        db.add(contestant)
        created.append(contestant)

    db.commit()
    for c in created:
        db.refresh(c)
    return created


def delete_contestant(db: Session, contestant_id: int) -> None:
    """Xoá thí sinh khỏi DB."""
    c = db.query(Contestant).filter(Contestant.id == contestant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy người chơi #{contestant_id}")
    db.delete(c)
    db.commit()


def get_contestants(
    db: Session,
    contest_id: Optional[int] = None,
    status: Optional[ContestantStatus] = None
) -> List[Contestant]:
    q = db.query(Contestant)
    if contest_id:
        q = q.filter(Contestant.contest_id == contest_id)
    if status:
        q = q.filter(Contestant.status == status)
    return q.order_by(Contestant.card_id).all()


def update_contestant_status(
    db: Session,
    contestant_id: int,
    new_status: ContestantStatus,
    current_question_index: Optional[int] = None
) -> Contestant:
    c = db.query(Contestant).filter(Contestant.id == contestant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy người chơi #{contestant_id}")
    c.status = new_status
    if new_status == ContestantStatus.eliminated and current_question_index is not None:
        c.eliminated_at_question = current_question_index
    db.commit()
    db.refresh(c)
    return c


def reset_contestants_for_session(db: Session, contest_id: int):
    """Reset tất cả về active trước khi bắt đầu phiên mới."""
    db.query(Contestant).filter(Contestant.contest_id == contest_id).update({
        "status": ContestantStatus.active,
        "eliminated_at_question": None
    })
    db.commit()
