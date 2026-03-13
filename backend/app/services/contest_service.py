from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.models import Contest, Question
from app.schemas.schemas import ContestCreate, QuestionCreate
from typing import List


def create_contest(db: Session, data: ContestCreate, created_by: str = None) -> Contest:
    contest = Contest(title=data.title, description=data.description, bank_id=data.bank_id, created_by=created_by)
    db.add(contest)
    db.commit()
    db.refresh(contest)
    return contest


def get_contest(db: Session, contest_id: int) -> Contest:
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy cuộc thi #{contest_id}")
    return contest


def list_contests(db: Session) -> List[Contest]:
    return db.query(Contest).order_by(Contest.created_at.desc()).all()


def update_contest(db: Session, contest_id: int, title: str, description: str = "", bank_id: int = None, max_contestants: int = None) -> Contest:
    contest = get_contest(db, contest_id)
    if title:
        contest.title = title
    if description is not None:
        contest.description = description
    contest.bank_id = bank_id
    contest.max_contestants = max_contestants
    db.commit()
    db.refresh(contest)
    return contest


# Moved to bank_service.py

def delete_contest(db: Session, contest_id: int):
    contest = get_contest(db, contest_id)
    db.delete(contest)
    db.commit()
