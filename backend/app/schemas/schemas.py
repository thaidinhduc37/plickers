"""
Pydantic schemas cho Rung Chuông Vàng API.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field


# ─── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── QuestionBank (Ngân hàng câu hỏi) ──────────────────────────────────────────

class QuestionBankCreate(BaseModel):
    title: str
    description: Optional[str] = ""

class QuestionBankOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    created_at: Optional[datetime]
    questions: List["QuestionOut"] = []

    class Config:
        from_attributes = True

class QuestionBankSummary(BaseModel):
    id: int
    title: str
    description: Optional[str]
    created_at: Optional[datetime]
    question_count: int = 0

    class Config:
        from_attributes = True


# ─── Contest (Cuộc thi) ────────────────────────────────────────────────────────

class ContestCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    bank_id: Optional[int] = None
    max_contestants: Optional[int] = None

class ContestOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    bank_id: Optional[int]
    created_at: Optional[datetime]
    bank: Optional["QuestionBankOut"] = None

    class Config:
        from_attributes = True

class ContestSummary(BaseModel):
    id: int
    title: str
    description: Optional[str]
    created_at: Optional[datetime]
    question_count: int = 0
    max_contestants: Optional[int] = None

    class Config:
        from_attributes = True


# ─── Question (Câu hỏi) ────────────────────────────────────────────────────────

class QuestionCreate(BaseModel):
    order_index: int = 0
    text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str = Field(..., pattern="^[ABCD]$")
    time_limit_sec: int = 30

class QuestionOut(BaseModel):
    id: int
    bank_id: int
    order_index: int
    text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str
    time_limit_sec: int

    class Config:
        from_attributes = True


# ─── Contestant (Người chơi) ──────────────────────────────────────────────────

class ContestantOut(BaseModel):
    id: int
    name: str
    card_id: int
    contest_id: Optional[int]
    status: str
    eliminated_at_question: Optional[int] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class ContestantStatusUpdate(BaseModel):
    status: str   # active | eliminated | winner
    note: Optional[str] = None


# ─── Session (Phiên thi) ──────────────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    contest_id: int

class SessionOut(BaseModel):
    id: str
    contest_id: int
    state: str
    current_question_index: int
    started_at: Optional[datetime]
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ActiveSessionResponse(BaseModel):
    session_id: str
    contest_id: int
    state: str
    current_question_index: int
    total_questions: int
    current_question: Optional[QuestionOut] = None
    active_contestants: int
    scanned_count: int


# ─── Scan (Quét thẻ từ CV Service) ────────────────────────────────────────────

class ScanResult(BaseModel):
    card_id: int
    answer: str = Field(..., pattern="^[ABCD]$")

class ScanSubmit(BaseModel):
    session_id: str
    results: List[ScanResult]


# ─── Cards ───────────────────────────────────────────────────────────────────

class CardGenerateRequest(BaseModel):
    count: int = Field(default=50, ge=1, le=200)
    start_id: int = 0


# Rebuild for forward references
ContestOut.model_rebuild()
