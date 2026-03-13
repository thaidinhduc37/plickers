from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user_or_auto
from app.schemas.schemas import QuestionBankCreate, QuestionBankOut, QuestionCreate, QuestionOut
from app.services import bank_service
from app.models.models import Question

router = APIRouter(prefix="/api/banks", tags=["QuestionBank"])
auth = Depends(get_current_user_or_auto)

@router.post("/", response_model=QuestionBankOut)
def create_bank(data: QuestionBankCreate, db: Session = Depends(get_db), user=auth):
    return bank_service.create_bank(db, data, created_by=user.username)

@router.get("", response_model=List[QuestionBankOut])
@router.get("/", response_model=List[QuestionBankOut])
def list_banks(db: Session = Depends(get_db), _=auth):
    return bank_service.list_banks(db)

@router.get("/{bank_id}", response_model=QuestionBankOut)
def get_bank(bank_id: int, db: Session = Depends(get_db), _=auth):
    return bank_service.get_bank(db, bank_id)

@router.delete("/{bank_id}")
def delete_bank(bank_id: int, db: Session = Depends(get_db), _=auth):
    bank_service.delete_bank(db, bank_id)
    return {"status": "ok"}

@router.patch("/{bank_id}", response_model=QuestionBankOut)
def update_bank(bank_id: int, data: dict, db: Session = Depends(get_db), _=auth):
    title = data.get("title")
    description = data.get("description", "")
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    return bank_service.update_bank(db, bank_id, title, description)

@router.post("/{bank_id}/questions", response_model=QuestionOut)
def add_question(bank_id: int, data: QuestionCreate, db: Session = Depends(get_db), _=auth):
    return bank_service.add_question(db, bank_id, data)

@router.post("/{bank_id}/questions/bulk", response_model=List[QuestionOut])
def bulk_add_questions(bank_id: int, questions: List[QuestionCreate], db: Session = Depends(get_db), _=auth):
    return bank_service.bulk_add_questions(db, bank_id, questions)

@router.patch("/{bank_id}/questions/{question_id}", response_model=QuestionOut)
def update_question(bank_id: int, question_id: int, data: dict, db: Session = Depends(get_db), _=auth):
    return bank_service.update_question(db, bank_id, question_id, data)

@router.delete("/{bank_id}/questions/{question_id}")
def delete_question(bank_id: int, question_id: int, db: Session = Depends(get_db), _=auth):
    bank_service.delete_question(db, bank_id, question_id)
    return {"status": "ok"}


@router.patch("/{bank_id}/questions/{question_id}/toggle-backup", response_model=QuestionOut)
def toggle_question_backup(bank_id: int, question_id: int, db: Session = Depends(get_db), _=auth):
    """Đánh dấu/khử đánh dấu câu hỏi dự phòng."""
    question = db.query(Question).filter(
        Question.id == question_id, Question.bank_id == bank_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    question.is_backup = not question.is_backup
    db.commit()
    db.refresh(question)
    return question

