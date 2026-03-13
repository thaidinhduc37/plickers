from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user_or_auto
from app.schemas.schemas import ContestCreate, ContestOut, ContestSummary, QuestionCreate, QuestionOut
from app.services import contest_service

router = APIRouter(prefix="/api/contests", tags=["Contests"])
auth = Depends(get_current_user_or_auto)


@router.post("", response_model=ContestOut)
def create_contest(data: ContestCreate, db: Session = Depends(get_db), user=auth):
    return contest_service.create_contest(db, data, created_by=user.username)


@router.get("", response_model=List[ContestSummary])
def list_contests(db: Session = Depends(get_db), _=auth):
    contests = contest_service.list_contests(db)
    result = []
    for c in contests:
        # Questions belong to bank, not contest
        question_count = len(c.bank.questions) if c.bank else 0
        result.append(ContestSummary(
            id=c.id,
            title=c.title,
            description=c.description,
            created_by=c.created_by,
            created_at=c.created_at,
            question_count=question_count,
            max_contestants=c.max_contestants,
        ))
    return result


@router.get("/{contest_id}", response_model=ContestOut)
def get_contest(contest_id: int, db: Session = Depends(get_db), _=auth):
    return contest_service.get_contest(db, contest_id)


@router.patch("/{contest_id}", response_model=ContestOut)
def update_contest(contest_id: int, data: ContestCreate, db: Session = Depends(get_db), _=auth):
    return contest_service.update_contest(db, contest_id, data.title, data.description or "", data.bank_id, data.max_contestants)


# Questions route moved to /api/banks/{bank_id}/questions



@router.delete("/{contest_id}", status_code=204)
def delete_contest(contest_id: int, db: Session = Depends(get_db), _=auth):
    contest_service.delete_contest(db, contest_id)
