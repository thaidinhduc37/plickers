import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, ForeignKey,
    DateTime, Enum, Text, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.core.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class ContestantStatus(str, enum.Enum):
    active = "active"
    eliminated = "eliminated"
    winner = "winner"


class SessionState(str, enum.Enum):
    waiting = "waiting"        # Chờ bắt đầu
    scanning = "scanning"      # Đang quét thẻ
    revealed = "revealed"      # Đã hiện đáp án
    ended = "ended"            # Kết thúc


class LogEventType(str, enum.Enum):
    session_started = "session_started"
    question_opened = "question_opened"
    answer_scanned = "answer_scanned"
    answer_revealed = "answer_revealed"
    contestants_eliminated = "contestants_eliminated"
    session_ended = "session_ended"
    btc_override = "btc_override"


# ─── Models ───────────────────────────────────────────────────────────────────

class QuestionBank(Base):
    """Ngân hàng câu hỏi — dùng chung cho nhiều cuộc thi."""
    __tablename__ = "question_banks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship("Question", back_populates="bank",
                             order_by="Question.order_index", cascade="all, delete-orphan")
    contests = relationship("Contest", back_populates="bank")


class Contest(Base):
    """Cuộc thi — chọn 1 ngân hàng câu hỏi, chứa danh sách TS và session."""
    __tablename__ = "contests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id", ondelete="SET NULL"), nullable=True)
    max_contestants = Column(Integer, nullable=True)  # Số lượng thí sinh tối đa (NULL = không giới hạn)
    created_at = Column(DateTime, default=datetime.utcnow)

    bank = relationship("QuestionBank", back_populates="contests")
    contestants = relationship("Contestant", back_populates="contest",
                               cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="contest",
                            cascade="all, delete-orphan")


class Question(Base):
    """Câu hỏi trong cuộc thi."""
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)  # Thứ tự hiển thị
    text = Column(Text, nullable=False)
    option_a = Column(String(500), nullable=False)
    option_b = Column(String(500), nullable=False)
    option_c = Column(String(500), nullable=False)
    option_d = Column(String(500), nullable=False)
    correct_answer = Column(String(1), nullable=False)  # 'A' | 'B' | 'C' | 'D'
    time_limit_sec = Column(Integer, default=30)

    bank = relationship("QuestionBank", back_populates="questions")
    responses = relationship("Response", back_populates="question")


class Contestant(Base):
    """Người chơi — gắn với thẻ QR vật lý."""
    __tablename__ = "contestants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    card_id = Column(Integer, nullable=False, index=True)  # ID in trên thẻ — unique per-contest
    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), nullable=True)
    status = Column(
        Enum(ContestantStatus),
        default=ContestantStatus.active,
        nullable=False,
        index=True
    )
    eliminated_at_question = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contest = relationship("Contest", back_populates="contestants")
    responses = relationship("Response", back_populates="contestant", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('card_id', 'contest_id', name='uq_card_contest'),
    )


import random
import string

def generate_session_id():
    """Tạo mã phòng 6 chữ số ngẫu nhiên"""
    return ''.join(random.choices(string.digits, k=6))

class Session(Base):
    """Phiên thi — một lần chạy một cuộc thi."""
    __tablename__ = "sessions"

    id = Column(String(6), primary_key=True, default=generate_session_id, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"), nullable=False)
    state = Column(
        Enum(SessionState),
        default=SessionState.waiting,
        nullable=False,
        index=True
    )
    current_question_index = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    contest = relationship("Contest", back_populates="sessions")
    responses = relationship("Response", back_populates="session", cascade="all, delete-orphan")
    logs = relationship("SessionLog", back_populates="session",
                        order_by="SessionLog.occurred_at", cascade="all, delete-orphan")


class Response(Base):
    """Đáp án đã quét của người chơi trong phiên thi."""
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(6), ForeignKey("sessions.id"), nullable=False)
    contestant_id = Column(Integer, ForeignKey("contestants.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer = Column(String(1), nullable=False)  # 'A' | 'B' | 'C' | 'D'
    scanned_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="responses")
    contestant = relationship("Contestant", back_populates="responses")
    question = relationship("Question", back_populates="responses")


class SessionLog(Base):
    """Log sự kiện diễn ra trong phiên thi (loại thí sinh, đổi MC...)."""
    __tablename__ = "session_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(6), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)
    event_data = Column(JSON, nullable=True)  # Chi tiết sự kiện
    occurred_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="logs")
