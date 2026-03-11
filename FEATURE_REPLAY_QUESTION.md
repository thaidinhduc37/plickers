# Tính năng: Thi lại câu hỏi và Câu hỏi dự phòng

## 1. Phân tích vấn đề

### Tình huống thực tế

Trong quá trình tổ chức cuộc thi, có thể xảy ra các trường hợp:

1. **Câu hỏi bị sai**: MC đọc sai đáp án, câu hỏi có lỗi kỹ thuật.
2. **Hệ thống lỗi**: Quét thẻ bị lỗi, mất kết nối.
3. **Tranh chấp**: Thí sinh khiếu nại đáp án.

### Yêu cầu

- **Câu hỏi dự phòng**: Ngân hàng câu hỏi cần có thêm câu dự phòng để thay thế khi cần.
- **Reset tại câu**: Khi thi lại câu hỏi, chỉ reset trạng thái người chơi tại câu đó (không reset toàn bộ).
- **Bỏ qua câu**: Cho phép bỏ qua câu hỏi hiện tại mà không tính điểm.

---

## 2. Phân tích kiến trúc hiện tại

### Models liên quan

#### [`Question`](backend/app/models/models.py:70-86)

```python
class Question(Base):
    id = Column(Integer, primary_key=True)
    bank_id = Column(Integer, ForeignKey("question_banks.id"))
    order_index = Column(Integer, default=0)
    text = Column(Text)
    option_a, option_b, option_c, option_d = Column(String(500))
    correct_answer = Column(String(1))
    time_limit_sec = Column(Integer, default=30)
    # THiếu: is_backup (Boolean) - Đánh dấu câu dự phòng
```

#### [`Session`](backend/app/models/models.py:121-140)

```python
class Session(Base):
    id = Column(String(6), primary_key=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    state = Column(Enum(SessionState))  # waiting | scanning | revealed | ended
    current_question_index = Column(Integer, default=0)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
```

#### [`Contestant`](backend/app/models/models.py:89-111)

```python
class Contestant(Base):
    id = Column(Integer, primary_key=True)
    name = Column(String(200))
    card_id = Column(Integer)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    status = Column(Enum(ContestantStatus))  # active | eliminated | winner
    eliminated_at_question = Column(Integer)  # Câu hỏi mà người chơi bị loại
```

#### [`Response`](backend/app/models/models.py:143-156)

```python
class Response(Base):
    id = Column(Integer, primary_key=True)
    session_id = Column(String(6), ForeignKey("sessions.id"))
    contestant_id = Column(Integer, ForeignKey("contestants.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    answer = Column(String(1))
    scanned_at = Column(DateTime)
```

### Functions hiện tại

#### [`reset_contestants_for_session()`](backend/app/services/contestant_service.py:106-112)

```python
def reset_contestants_for_session(db: Session, contest_id: int):
    """Reset TẤT CẢ về active trước khi bắt đầu phiên mới."""
    db.query(Contestant).filter(Contestant.contest_id == contest_id).update({
        "status": ContestantStatus.active,
        "eliminated_at_question": None
    })
    db.commit()
```

**Vấn đề**: Chỉ có thể reset toàn bộ, không reset tại câu cụ thể.

#### [`next_question()`](backend/app/services/session_service.py:298-341)

```python
def next_question(db: DBSession) -> dict:
    """Chuyển sang câu hỏi tiếp theo."""
    # Chỉ hoạt động khi state == 'revealed'
    # Không có logic bỏ qua câu hỏi
```

---

## 3. Giải pháp đề xuất

### 3.1. Thêm trường `is_backup` vào Question

**Mục đích**: Đánh dấu câu hỏi dự phòng trong ngân hàng.

**Thay đổi model**:

```python
# backend/app/models/models.py
class Question(Base):
    ...
    is_backup = Column(Boolean, default=False)  # Câu hỏi dự phòng
```

**Migration**:

```sql
ALTER TABLE questions ADD COLUMN is_backup BOOLEAN DEFAULT FALSE;
```

**UI**: Thêm checkbox "Câu dự phòng" khi chỉnh sửa câu hỏi trong Library.

---

### 3.2. Thêm hàm `reset_contestants_at_question()`

**Mục đích**: Reset trạng thái người chơi tại câu hỏi cụ thể.

**Logic**:

1. Tìm tất cả người chơi bị loại ở câu hỏi `target_question_index` hoặc sau đó.
2. Khôi phục họ về `active`.
3. Xóa `eliminated_at_question` của họ.
4. Xóa tất cả `Response` của câu hỏi `target_question_index`.

**Implementation**:

```python
# backend/app/services/contestant_service.py
from sqlalchemy import or_

def reset_contestants_at_question(db: Session, contest_id: int, target_question_index: int):
    """
    Reset trạng thái người chơi tại câu hỏi cụ thể.
    - Khôi phục người bị loại ở câu target_question_index hoặc sau đó.
    - Xóa responses của câu target_question_index.
    """
    # Tìm người bị loại ở câu target_question_index hoặc sau đó
    contestants_to_restore = db.query(Contestant).filter(
        Contestant.contest_id == contest_id,
        Contestant.status == ContestantStatus.eliminated,
        or_(
            Contestant.eliminated_at_question == target_question_index,
            Contestant.eliminated_at_question > target_question_index
        )
    ).all()

    for c in contestants_to_restore:
        c.status = ContestantStatus.active
        c.eliminated_at_question = None

    # Xóa responses của câu hỏi target_question_index
    session = db.query(Session).filter(
        Session.contest_id == contest_id,
        Session.state.in_([SessionState.scanning, SessionState.revealed])
    ).first()

    if session:
        question = db.query(Question).filter(
            Question.bank_id == session.contest.bank_id,
            Question.order_index == target_question_index
        ).first()
        if question:
            db.query(Response).filter(
                Response.session_id == session.id,
                Response.question_id == question.id
            ).delete()

    db.commit()
    return len(contestants_to_restore)
```

---

### 3.3. Thêm hàm `retry_question()`

**Mục đích**: Cho phép thi lại câu hỏi hiện tại.

**Logic**:

1. Kiểm tra session đang ở state `revealed` (đã hiện đáp án).
2. Gọi `reset_contestants_at_question()` để khôi phục người chơi.
3. Đặt lại state về `scanning`.
4. Ghi log sự kiện.

**Implementation**:

```python
# backend/app/services/session_service.py
from app.services.contestant_service import reset_contestants_at_question

def retry_question(db: DBSession) -> dict:
    """
    Thi lại câu hỏi hiện tại.
    - Khôi phục người chơi bị loại ở câu hiện tại.
    - Xóa responses của câu hiện tại.
    - Đặt lại state về scanning.
    """
    session = db.query(Session).filter(
        Session.state == SessionState.revealed
    ).with_for_update().first()

    if not session:
        active = _get_active_session(db)
        if not active:
            raise HTTPException(status_code=404, detail="Không có phiên thi nào đang hoạt động")
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', phải ở trạng thái 'revealed' để thi lại"
        )

    current_index = session.current_question_index

    # Reset người chơi tại câu hiện tại
    restored_count = reset_contestants_at_question(db, session.contest_id, current_index)

    # Đặt lại state
    session.state = SessionState.scanning
    db.commit()

    current_q = _get_current_question(session)

    _log(db, session.id, LogEventType.question_opened, {
        "question_index": current_index,
        "question_id": current_q.id if current_q else None,
        "action": "retry",
        "restored_contestants": restored_count
    })
    db.commit()

    return {
        "current_question_index": current_index,
        "total_questions": len(session.contest.bank.questions) if session.contest.bank else 0,
        "current_question": current_q,
        "active_contestants": _count_active(db, session.contest_id),
        "restored_contestants": restored_count,
    }
```

---

### 3.4. Thêm hàm `skip_question()`

**Mục đích**: Bỏ qua câu hỏi hiện tại (không tính điểm, không loại ai).

**Logic**:

1. Kiểm tra session đang ở state `revealed` hoặc `scanning`.
2. Chuyển sang câu tiếp theo.
3. KHÔNG loại ai (bỏ qua logic eliminate).
4. Ghi log sự kiện.

**Implementation**:

```python
# backend/app/services/session_service.py
def skip_question(db: DBSession) -> dict:
    """
    Bỏ qua câu hỏi hiện tại (không tính điểm).
    - Chuyển sang câu tiếp theo.
    - Không loại ai.
    """
    session = db.query(Session).filter(
        Session.state.in_([SessionState.scanning, SessionState.revealed])
    ).with_for_update().first()

    if not session:
        active = _get_active_session(db)
        if not active:
            raise HTTPException(status_code=404, detail="Không có phiên thi nào đang hoạt động")
        raise HTTPException(
            status_code=400,
            detail=f"Session đang ở trạng thái '{active.state}', phải ở trạng thái 'scanning' hoặc 'revealed' để bỏ qua"
        )

    total = len(session.contest.bank.questions) if session.contest.bank else 0
    next_index = session.current_question_index + 1

    if next_index >= total:
        raise HTTPException(status_code=400, detail="Đã hết câu hỏi")

    session.current_question_index = next_index
    session.state = SessionState.scanning
    db.commit()
    db.refresh(session)

    current_q = _get_current_question(session)
    _log(db, session.id, LogEventType.question_opened, {
        "question_index": next_index,
        "question_id": current_q.id if current_q else None,
        "action": "skip"
    })
    db.commit()

    return {
        "current_question_index": next_index,
        "total_questions": total,
        "current_question": current_q,
        "active_contestants": _count_active(db, session.contest_id),
    }
```

---

### 3.5. Thêm API endpoints

**File**: [`backend/app/api/routes/session.py`](backend/app/api/routes/session.py)

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.services import session_service

router = APIRouter(prefix="/api/sessions", tags=["Session"])
auth = Depends(get_current_user)

# ... existing routes ...

@router.post("/{session_id}/retry-question")
def retry_question_route(session_id: str, db: Session = Depends(get_db), _=auth):
    """Thi lại câu hỏi hiện tại."""
    return session_service.retry_question(db)

@router.post("/{session_id}/skip-question")
def skip_question_route(session_id: str, db: Session = Depends(get_db), _=auth):
    """Bỏ qua câu hỏi hiện tại (không tính điểm)."""
    return session_service.skip_question(db)
```

---

### 3.6. Thêm schema cho Question với `is_backup`

**File**: [`backend/app/schemas/schemas.py`](backend/app/schemas/schemas.py)

```python
class QuestionCreate(BaseModel):
    order_index: int = 0
    text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str = Field(..., pattern="^[ABCD]$")
    time_limit_sec: int = 30
    is_backup: bool = False  # Thêm trường này

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
    is_backup: bool = False  # Thêm trường này

    class Config:
        from_attributes = True
```

---

### 3.7. Thêm API endpoint toggle backup

**File**: [`backend/app/api/routes/banks.py`](backend/app/api/routes/banks.py)

```python
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
```

---

## 4. UI Changes

### 4.1. Library - Thêm checkbox "Câu dự phòng"

**File**: [`frontend/src/pages/Library.jsx`](frontend/src/pages/Library.jsx)

Thêm checkbox vào form chỉnh sửa câu hỏi:

```jsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={draft.is_backup || false}
    onChange={(e) => setDraft((d) => ({ ...d, is_backup: e.target.checked }))}
    className="w-4 h-4"
  />
  <label className="text-sm text-slate-600">Câu dự phòng</label>
</div>
```

### 4.2. LiveView - Thêm nút "Thi lại câu" và "Bỏ qua câu"

**File**: [`frontend/src/pages/LiveView.jsx`](frontend/src/pages/LiveView.jsx)

Thêm nút trong control panel khi state == `revealed`:

```jsx
{
  session.state === "revealed" && (
    <div className="flex gap-2 mt-4">
      <button
        onClick={handleRetryQuestion}
        className="px-4 py-2 text-sm font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-lg">
        🔄 Thi lại câu
      </button>
      <button
        onClick={handleSkipQuestion}
        className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
        ⏭️ Bỏ qua câu
      </button>
    </div>
  );
}
```

---

## 5. Test Scenarios

### Scenario 1: Thi lại câu hỏi

1. Bắt đầu phiên thi.
2. Trả lời câu 1, hiện đáp án, có người bị loại.
3. Click "Thi lại câu".
4. **Expected**: Người bị loại ở câu 1 được khôi phục, responses bị xóa, state về `scanning`.

### Scenario 2: Bỏ qua câu hỏi

1. Bắt đầu phiên thi.
2. Mở câu 1, không cần trả lời.
3. Click "Bỏ qua câu".
4. **Expected**: Chuyển sang câu 2, không ai bị loại, log sự kiện "skip".

### Scenario 3: Câu hỏi dự phòng

1. Tạo ngân hàng câu hỏi với 10 câu, trong đó 2 câu là dự phòng.
2. Tạo cuộc thi từ ngân hàng.
3. **Expected**: Cuộc thi chỉ lấy 8 câu chính (không lấy câu dự phòng).

---

## 6. Migration SQL

```sql
-- Thêm trường is_backup vào bảng questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_backup BOOLEAN DEFAULT FALSE;

-- Thêm log event type mới
-- (Không cần migration, dùng enum string trong code)
```

---

## 7. Summary

| Tính năng        | Model Changes        | Service Changes                                       | API Changes                                      | UI Changes                       |
| ---------------- | -------------------- | ----------------------------------------------------- | ------------------------------------------------ | -------------------------------- |
| Câu hỏi dự phòng | `Question.is_backup` | -                                                     | `PATCH /banks/{id}/questions/{id}/toggle-backup` | Checkbox trong Library           |
| Thi lại câu      | -                    | `retry_question()`, `reset_contestants_at_question()` | `POST /sessions/{id}/retry-question`             | Nút "Thi lại câu" trong LiveView |
| Bỏ qua câu       | -                    | `skip_question()`                                     | `POST /sessions/{id}/skip-question`              | Nút "Bỏ qua câu" trong LiveView  |

---

## 8. Next Steps

1. **Backend**:
   - [ ] Thêm migration cho `Question.is_backup`.
   - [ ] Thêm `retry_question()` và `skip_question()` vào `session_service.py`.
   - [ ] Thêm `reset_contestants_at_question()` vào `contestant_service.py`.
   - [ ] Thêm API endpoints vào `session.py` và `banks.py`.
   - [ ] Update schemas.

2. **Frontend**:
   - [ ] Thêm checkbox "Câu dự phòng" trong Library.
   - [ ] Thêm nút "Thi lại câu" và "Bỏ qua câu" trong LiveView.
   - [ ] Gọi API khi click nút.

3. **Testing**:
   - [ ] Test scenario thi lại câu.
   - [ ] Test scenario bỏ qua câu.
   - [ ] Test scenario câu dự phòng.
