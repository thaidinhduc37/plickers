# Plickers Contest System - Comprehensive Testing Guide

## Mục tiêu

Tài liệu này giúp tester hiểu rõ toàn bộ logic, luồng hoạt động, và các trường hợp biên (edge cases) của hệ thống tổ chức cuộc thi Plickers để tạo ra các test case toàn diện.

---

## 1. Tổng quan kiến trúc

### 1.1. Các thành phần chính

- **Backend**: FastAPI (Python) + SQLAlchemy + WebSocket
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL
- **Real-time Communication**: BroadcastChannel (giữa các tab) + WebSocket (client-server)

### 1.2. Các thực thể (Entities)

| Entity        | Mô tả                                                  |
| ------------- | ------------------------------------------------------ |
| `Bank`        | Thư viện câu hỏi, chứa nhiều `Question`                |
| `Question`    | Câu hỏi với 4 đáp án (A, B, C, D) và đáp án đúng       |
| `Contest`     | Cuộc thi, chứa nhiều `QuestionSet`                     |
| `QuestionSet` | Bộ câu hỏi trong một cuộc thi                          |
| `Contestant`  | Người thi, có `card_id` và `name`                      |
| `Session`     | Phiên thi, chứa trạng thái hiện tại của cuộc thi       |
| `Response`    | Trả lời của người thi (card_id -> {answer, timestamp}) |
| `Vote`        | Tổng hợp số lượng chọn mỗi đáp án                      |

---

## 2. Luồng hoạt động chính (Main Flow)

### 2.1. Quy trình tổ chức cuộc thi

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTEST LIFECYCLE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. KHỞI TẠO (Initialization)
   ├─ Tạo Bank (thư viện câu hỏi)
   ├─ Thêm Questions vào Bank
   ├─ Tạo Contest (cuộc thi)
   └─ Thêm QuestionSet vào Contest

2. CHUẨN BỊ (Preparation)
   ├─ Thêm Contestants (người thi)
   ├─ Phân bổ Contestants cho Contest
   └─ Tạo Session (phiên thi)

3. BẮT ĐẦU THI (Start Session)
   ├─ Chọn QuestionSet
   ├─ Chọn thời gian làm bài
   └─ Bấm "Bắt đầu"

4. VÒNG THI (Question Loop) ───────────────────────────────────────────────────
   │                                                                            │
   │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────────┐ │
   │  │  QUESTION   │───▶│  COUNTDOWN  │───▶│  SCANNING   │───▶│ REVEALED   │ │
   │  │  (Chọn Q)   │    │  (Đếm giờ)  │    │  (Quét QR)  │    │ (Công bố)  │ │
   │  └─────────────┘    └─────────────┘    └─────────────┘    └────────────┘ │
   │         ▲                                                        │       │
   │         │                        ┌───────────────────────────────┘       │
   │         │                        │                                        │
   │         └────────────────────────┴───────────────────────────────────────┘
   │                                                                            │
   └────────────────────────────────────────────────────────────────────────────

5. KẾT THÚC (End Session)
   ├─ Bấm "Kết thúc phiên thi"
   └─ Hiển thị bảng xếp hạng

6. CẤU HÌNH ĐẶC BIỆT (Special Features)
   ├─ Rescue: Cứu trợ người bị loại
   ├─ Retry: Thi lại câu hỏi hiện tại
   ├─ Skip: Bỏ qua câu hỏi hiện tại
   └─ Backup: Câu hỏi dự phòng
```

---

## 3. Chi tiết từng phase

### 3.1. Phase: `question`

**Mục đích**: Chọn câu hỏi và thời gian làm bài

**Trạng thái**:

- `session`: null hoặc thông tin session
- `phase`: 'question'
- `timer`: null
- `responses`: {}

**Hành động khả dụng**:

- Chọn thời gian từ dropdown (10s, 15s, 20s, 30s, 45s, 60s)
- Bấm "Bắt đầu" → chuyển sang `countdown`

**Edge Cases**:

- [ ] Không chọn thời gian → Bấm "Bắt đầu" có bị chặn không?
- [ ] Chọn câu hỏi cuối cùng → Nút "Câu tiếp" có bị disable không?
- [ ] Session chưa được khởi tạo → Có hiển thị thông báo không?

### 3.2. Phase: `countdown`

**Mục đích**: Đếm ngược thời gian trước khi quét

**Trạng thái**:

- `phase`: 'countdown'
- `timer`: số giây còn lại
- `timerRunning`: true

**Hành động khả dụng**:

- Tạm dừng/Tiếp tục đếm
- Bấm "Kết thúc giờ" → chuyển sang `scanning` ngay

**Edge Cases**:

- [ ] Đếm về 0 → Tự động chuyển sang `scanning`?
- [ ] Tạm dừng nhiều lần → Thời gian tổng có chính xác không?
- [ ] Kết thúc giờ khi chưa quét ai → Chuyển sang `scanning` với 0 response?
- [ ] Network disconnect trong countdown → Reconnect có tiếp tục đếm không?

### 3.3. Phase: `scanning`

**Mục đích**: Quét mã QR của người thi

**Trạng thái**:

- `phase`: 'scanning'
- `responses`: { card_id: { answer, timestamp, contestant_name } }
- `votes`: { A: 0, B: 0, C: 0, D: 0, total: 0 }

**Hành động khả dụng**:

- Quét QR code (qua camera hoặc upload)
- Bấm "Hiện đáp án" → chuyển sang `revealed`
- Bấm "Xoá phiếu" → xóa tất cả responses

**Logic quan trọng**:

```javascript
// Khi nhận response từ WebSocket
if (response.card_id in eliminated_contestants) {
  // Bỏ qua - người này đã bị loại
  return;
}
// Cập nhật response
responsesMap[card_id] = response;
// Cập nhật votes
votes[response.answer]++;
votes.total++;
```

**Edge Cases**:

- [ ] Quét cùng 1 card nhiều lần → Chỉ tính lần đầu?
- [ ] Quét card của người đã bị loại → Có bị bỏ qua không?
- [ ] Quét card không tồn tại → Có thông báo lỗi không?
- [ ] Quét khi phase khác `scanning` → Có bị từ chối không?
- [ ] Nhiều người quét cùng lúc → Race condition có xảy ra không?
- [ ] Camera disconnect trong scanning → Có thông báo không?

### 3.4. Phase: `revealed`

**Mục đích**: Công bố đáp án và hiển thị kết quả

**Trạng thái**:

- `phase`: 'revealed'
- `isRevealed`: true
- `session.responses`: đã được lưu vào DB

**Hành động khả dụng**:

- "Ẩn đáp án" → quay lại `scanning`
- "Thi lại câu" → restore contestants, xóa responses, quay lại `scanning`
- "Bỏ qua câu" → chuyển sang câu tiếp theo
- "Cứu trợ" → mở modal cứu trợ
- "Câu tiếp" → quay lại `question`

**Logic quan trọng**:

```javascript
// Khi reveal answer
1. Tính toán eliminated contestants:
   for each contestant:
       if contestant.response != correct_answer:
           eliminated.push(contestant)

2. Lưu responses vào DB

3. Broadcast state cho tất cả clients

4. Cập nhật WebSocket state
```

**Edge Cases**:

- [ ] Không có response nào → Hiển thị gì?
- [ ] Tất cả đều đúng → Không có ai bị loại?
- [ ] Tất cả đều sai → Tất cả bị loại?
- [ ] Reveal khi đang đếm giờ → Có bị chặn không?
- [ ] Multiple clients reveal cùng lúc → Ai thắng?

---

## 4. Các tính năng đặc biệt

### 4.1. Rescue (Cứu trợ)

**Mục đích**: Khôi phục người bị loại

**Chế độ**:

1. **Random**: Chọn ngẫu nhiên N người để cứu
2. **Manual**: Chọn thủ công từng người
3. **Deepest**: Cứu người bị loại ở câu sâu nhất

**Logic**:

```javascript
// Rescue logic
const rescued = [];
switch (mode) {
  case "random":
    rescued = shuffle(eliminated).slice(0, count);
    break;
  case "manual":
    rescued = selectedIds.map((id) => eliminated.find((e) => e.id === id));
    break;
  case "deepest":
    // Group by question_index, find deepest
    const byIndex = groupBy(eliminated, "question_index");
    const deepestIndex = Math.max(...Object.keys(byIndex));
    rescued = byIndex[deepestIndex].slice(0, count);
    break;
}
// Update contestants: eliminated = false
// Broadcast update
```

**Edge Cases**:

- [ ] Rescue khi không có ai bị loại → Có thông báo không?
- [ ] Rescue nhiều lần → Có tích lũy không?
- [ ] Rescue mode không hợp lệ → Có fallback không?
- [ ] Rescue trong khi đang scanning → Có bị chặn không?

### 4.2. Retry Question (Thi lại câu)

**Mục đích**: Cho phép thi lại câu hỏi hiện tại

**Logic**:

```javascript
async retryQuestion() {
    const currentQIndex = session.questionIndex;

    // 1. Restore contestants eliminated at this question
    await resetContestantsAtQuestion(currentQIndex);

    // 2. Delete responses for this question
    await deleteResponsesAtQuestion(currentQIndex);

    // 3. Reset session state
    session.phase = 'scanning';
    session.responses = {};

    // 4. Broadcast to all clients
    broadcastState({ phase: 'scanning', responses: {} });
}
```

**Edge Cases**:

- [ ] Retry ở câu đầu tiên → Có hoạt động không?
- [ ] Retry khi chưa có response → Có cần thiết không?
- [ ] Retry nhiều lần → Có tích lũy lỗi không?
- [ ] Retry trong khi đang đếm giờ → Có bị chặn không?
- [ ] Retry khi đang reveal → Có bị chặn không?

### 4.3. Skip Question (Bỏ qua câu)

**Mục đích**: Bỏ qua câu hỏi hiện tại, chuyển sang câu tiếp

**Logic**:

```javascript
async skipQuestion() {
    // 1. Không lưu response, không loại ai
    // 2. Tăng questionIndex
    session.questionIndex++;

    // 3. Nếu còn câu → chuyển sang 'question'
    if (session.questionIndex < totalQuestions) {
        session.phase = 'question';
    } else {
        // Kết thúc session
        session.phase = 'ended';
    }

    // 4. Broadcast
    broadcastState(session);
}
```

**Edge Cases**:

- [ ] Skip câu cuối → Có kết thúc session không?
- [ ] Skip khi chưa bắt đầu → Có bị chặn không?
- [ ] Skip nhiều lần liên tiếp → Có hoạt động không?
- [ ] Skip trong khi đang scanning → Có bị chặn không?

### 4.4. Backup Question (Câu dự phòng)

**Mục đích**: Đánh dấu câu hỏi là dự phòng, không tính vào điểm

**Logic**:

```javascript
// Khi load questions
questions = questions.filter(q => !q.is_backup || showBackup);

// Khi tính điểm
if (question.is_backup) {
    // Bỏ qua, không tính
    continue;
}
```

**Edge Cases**:

- [ ] Tất cả câu đều là backup → Có thông báo không?
- [ ] Toggle backup khi đang thi → Có ảnh hưởng không?
- [ ] Backup question trong skip → Có được tính không?

---

## 5. WebSocket Real-time Sync

### 5.1. Events

| Event                    | Hướng           | Mô tả                       |
| ------------------------ | --------------- | --------------------------- |
| `answer_received`        | Server → Client | Nhận câu trả lời mới        |
| `contestants_eliminated` | Server → Client | Cập nhật người bị loại      |
| `session_state_updated`  | Server → Client | Cập nhật trạng thái session |
| `join_session`           | Client → Server | Tham gia session            |
| `submit_scan`            | Client → Server | Gửi kết quả quét            |

### 5.2. Sync Logic

```javascript
// BroadcastChannel (giữa các tab)
const channel = new BroadcastChannel("presentation_channel");

// Tab A (chính)
channel.postMessage({ type: "state_update", state: newState });

// Tab B (presentation)
channel.onmessage = (event) => {
  if (event.data.type === "state_update") {
    syncState(event.data.state);
  }
};
```

**Edge Cases**:

- [ ] WS disconnect → Reconnect có sync lại state không?
- [ ] Multiple tabs mở cùng session → Tab nào là master?
- [ ] BroadcastChannel không support (Safari) → Fallback là gì?
- [ ] State conflict (2 tab cùng update) → Ai thắng?

---

## 6. Database Operations

### 6.1. Transactions

```python
# Session service - reveal_answer
async def reveal_answer(session_id: int):
    async with db_session() as db:
        async with db.begin():  # Transaction
            # 1. Tính toán eliminated
            eliminated = calculate_eliminated(session)

            # 2. Lưu responses
            for card_id, response in session.responses.items():
                db.add(Response(...))

            # 3. Cập nhật contestants
            for c in eliminated:
                c.eliminated = True

            # 4. Commit
            await db.commit()
```

**Edge Cases**:

- [ ] Transaction fail ở bước 3 → Rollback có hoàn toàn không?
- [ ] Concurrent reveal (2 request cùng lúc) → Lock có hoạt động không?
- [ ] DB connection lost trong transaction → Retry có an toàn không?

---

## 7. Race Conditions & Concurrency

### 7.1. Scenarios cần test

1. **Multiple scans same card**:
   - Người A quét card X → Response được lưu
   - Người B quét cùng card X → Có bị từ chối không?

2. **Concurrent reveal**:
   - Tab A bấm "Hiện đáp án"
   - Tab B bấm "Hiện đáp án" cùng lúc
   - Ai thắng? Có duplicate data không?

3. **Scan during reveal**:
   - Đang reveal → Người quét QR
   - Response có được lưu không?

4. **Retry during scan**:
   - Đang scanning → Bấm "Thi lại câu"
   - State có bị conflict không?

### 7.2. Expected Behavior

```javascript
// Race condition protection
const scanLock = new Map(); // card_id -> promise

async submitScan(card_id, response) {
    if (scanLock.has(card_id)) {
        throw new Error('Scan đang xử lý');
    }

    try {
        scanLock.set(card_id, true);
        // Process scan
    } finally {
        scanLock.delete(card_id);
    }
}
```

---

## 8. Error Handling

### 8.1. API Errors

```javascript
// Expected error codes
400: Bad Request (tham số không hợp lệ)
404: Not Found (session/question không tồn tại)
409: Conflict (trạng thái không cho phép)
500: Internal Server Error

// Handling
try {
    await api.retryQuestion();
} catch (e) {
    if (e.status === 409) {
        showToast('error', 'Không thể thi lại câu ở phase này');
    }
}
```

### 8.2. WebSocket Errors

```javascript
// Reconnect logic
ws.onclose = () => {
  setTimeout(() => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      // Re-sync state
      fetchActiveSession();
    };
  }, 3000);
};
```

---

## 9. UI/UX Testing

### 9.1. Responsive Design

- [ ] Mobile (320px - 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (1024px+)

### 9.2. Accessibility

- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast

### 9.3. Performance

- [ ] Load 1000 contestants → Render có mượt không?
- [ ] Scan liên tục 100 QR → Có lag không?
- [ ] Session kéo dài 1 giờ → Memory leak không?

---

## 10. Test Scenarios Checklist

### 10.1. Happy Path

- [ ] Tạo bank → Thêm câu hỏi → Tạo contest → Thêm người thi → Bắt đầu thi → Quét → Reveal → Kết thúc
- [ ] Rescue người bị loại → Tiếp tục thi
- [ ] Retry câu hỏi → Thi lại
- [ ] Skip câu hỏi → Chuyển sang câu tiếp

### 10.2. Edge Cases

- [ ] Session với 0 người thi
- [ ] Session với 1 người thi
- [ ] Session với 1000 người thi
- [ ] Câu hỏi với 0 response
- [ ] Câu hỏi với tất cả đúng
- [ ] Câu hỏi với tất cả sai
- [ ] Rescue khi không có ai bị loại
- [ ] Retry ở câu đầu tiên
- [ ] Skip câu cuối cùng
- [ ] Network disconnect giữa phase

### 10.3. Error Cases

- [ ] Quét card không tồn tại
- [ ] Quét khi phase không phải scanning
- [ ] Reveal khi chưa có response
- [ ] Retry khi không có response
- [ ] Skip khi chỉ có 1 câu
- [ ] DB connection lost
- [ ] WS connection lost

### 10.4. Concurrency

- [ ] 2 tab cùng mở session
- [ ] 2 request reveal cùng lúc
- [ ] Scan cùng card nhiều lần
- [ ] Rescue trong khi scanning

---

## 11. Known Bugs & Fixes

### 11.1. Fixed Bugs

| Bug                                         | Severity | Fix                             |
| ------------------------------------------- | -------- | ------------------------------- |
| Race condition khi submit scan              | Critical | Thêm lock cho mỗi card_id       |
| Contestant bị loại không được cập nhật ngay | High     | WS broadcast ngay khi eliminate |
| Response không được lưu vào DB khi reveal   | High     | Transaction commit đúng chỗ     |
| Rescue không restore điểm đúng              | Medium   | Fix logic tính điểm lại         |
| UI không sync khi multiple tabs             | Medium   | BroadcastChannel + WS           |

### 11.2. Pending Issues

| Issue                                 | Severity | Status          |
| ------------------------------------- | -------- | --------------- |
| Memory leak khi session dài           | Medium   | Investigating   |
| Safari không support BroadcastChannel | Low      | Fallback needed |
| Load test với 10k contestants         | Low      | Not tested      |

---

## 12. Testing Commands

### 12.1. Backend

```bash
# Run tests
cd backend
pytest -v

# Run specific test
pytest tests/test_session.py::test_reveal_answer -v

# Coverage
pytest --cov=app --cov-report=html
```

### 12.2. Frontend

```bash
# Run tests
cd frontend
npm test

# E2E with Playwright
npx playwright test

# Lint
npm run lint
```

---

## 13. Reporting Bugs

Khi phát hiện bug, báo cáo theo format:

```markdown
## Bug: [Tóm tắt bug]

**Severity**: Critical/High/Medium/Low

**Steps to Reproduce**:

1. ...
2. ...
3. ...

**Expected Behavior**:
...

**Actual Behavior**:
...

**Environment**:

- Browser: ...
- OS: ...
- Device: ...

**Screenshots**:
[Attach if applicable]

**Logs**:
[Attach error logs if applicable]
```

---

## 14. Conclusion

Tài liệu này cung cấp cái nhìn toàn diện về hệ thống Plickers để tester có thể:

1. Hiểu rõ luồng hoạt động chính
2. Nhận diện các edge cases
3. Test các tính năng đặc biệt
4. Phát hiện race conditions
5. Báo cáo bug hiệu quả

**Lưu ý**: Tài liệu này sẽ được cập nhật khi có tính năng mới hoặc bug mới được phát hiện.
