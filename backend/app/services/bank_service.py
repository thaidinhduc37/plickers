from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.models import QuestionBank, Question, Contest
from app.schemas.schemas import QuestionBankCreate, QuestionCreate
from typing import List


def create_bank(db: Session, data: QuestionBankCreate) -> QuestionBank:
    bank = QuestionBank(title=data.title, description=data.description)
    db.add(bank)
    db.commit()
    db.refresh(bank)
    return bank


def get_bank(db: Session, bank_id: int) -> QuestionBank:
    bank = db.query(QuestionBank).filter(QuestionBank.id == bank_id).first()
    if not bank:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy ngân hàng câu hỏi #{bank_id}")
    return bank


def list_banks(db: Session) -> List[QuestionBank]:
    return db.query(QuestionBank).order_by(QuestionBank.created_at.desc()).all()


def add_question(db: Session, bank_id: int, data: QuestionCreate) -> Question:
    get_bank(db, bank_id)  # validate exists
    question = Question(**data.dict(), bank_id=bank_id)
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


def bulk_add_questions(db: Session, bank_id: int, questions: List[QuestionCreate]) -> List[Question]:
    get_bank(db, bank_id)
    created = []
    for i, q in enumerate(questions):
        if q.order_index == 0:
            q = q.model_copy(update={"order_index": i + 1})
        question = Question(**q.dict(), bank_id=bank_id)
        db.add(question)
        created.append(question)
    db.commit()
    return created


def delete_bank(db: Session, bank_id: int):
    # Nullify bank_id in contests instead of cascade delete contests
    bank = get_bank(db, bank_id)
    db.query(Contest).filter(Contest.bank_id == bank_id).update({Contest.bank_id: None})
    db.delete(bank)
    db.commit()


def update_question(db: Session, bank_id: int, question_id: int, data: dict) -> Question:
    question = db.query(Question).filter(Question.id == question_id, Question.bank_id == bank_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    for k, v in data.items():
        if hasattr(question, k):
            setattr(question, k, v)
    db.commit()
    db.refresh(question)
    return question


def delete_question(db: Session, bank_id: int, question_id: int):
    question = db.query(Question).filter(Question.id == question_id, Question.bank_id == bank_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    db.delete(question)
    db.commit()
