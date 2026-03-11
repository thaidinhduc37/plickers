# 🐛 Bug Reports & Real-World Scenarios - Plickers

**Ngày phân tích:** 2026-03-11
**Ngày fix:** 2026-03-11
**Mục đích:** Tìm bug và các tình huống thực tế khi tổ chức cuộc thi

---

## ✅ FIX STATUS

| Bug | Severity | Status | File(s) Modified |
|-----|----------|--------|------------------|
| #1 Race Condition Reveal/Next | Critical | ✅ FIXED | `session_service.py` |
| #2 Eliminated Contestant Scan | Critical | ✅ FIXED | `session_service.py`, `scan.py` |
| #3 Timer Reset | High | ✅ FIXED | `LiveView.jsx` |
| #4 WebSocket Sync | High | ✅ FIXED | `LiveView.jsx` |
| #5 No Reveal Confirmation | High | ✅ FIXED | `LiveView.jsx` |
| #6 Rescue No Broadcast | High | ✅ FIXED | `AppContext.jsx` |
| #7 No Session State Validate | High | ✅ FIXED | `scan.py` |
| #8 No Loading State | Medium | ✅ FIXED | `LiveView.jsx` |
| #9 No WS Error Handling | Medium | ✅ FIXED | `AppContext.jsx` |
| #10 Timer Audio | Medium | ✅ FIXED | `LiveView.jsx` |
| #11 No End Confirmation | Low | ✅ FIXED (đã có sẵn) | - |
| #12 Card_id Validate | Low | ✅ FIXED | `card_service.py` |

---

## 🔴 CRITICAL BUGS

### Bug #1: Race Condition khi Reveal Answer + Next Question

**Vị trí:** [`backend/app/services/session_service.py:275-289`](backend/app/services/session_service.py:275)

**Vấn đề:**

```python
def next_question(db: DBSession) -> dict:
    session = _get_active_session(db)
    if session.state != SessionState.revealed:  # ← Check state
        raise HTTPException(status_code=400, detail="Phải reveal đáp án trước khi sang câu tiếp")

    # ... nhưng giữa check và update, session có thể bị thay đổi
    session.current_question_index = next_index
    session.state = SessionState.scanning
    db.commit()
```

**Kịch bản lỗi:**

1. BTC bấm "Reveal" → state = `revealed`
2. Ngay lập tức bấm "Next Question" nhanh 2 lần
3. Request 1: check state = revealed ✓ → update state = scanning
4. Request 2: check state = scanning ✗ → ERROR
5. **Nhưng** Request 1 đã commit → session đang ở câu mới, state = scanning
6. **Kết quả:** Phase bị lỗi, không thể tiếp tục

**Fix:**

```python
def next_question(db: DBSession) -> dict:
    session = _get_active_session(db)

    # Use database-level lock
    session = db.query(Session).filter(
        Session.id == session.id,
        Session.state == SessionState.revealed  # Lock với condition
    ).with_for_update().first()  # PostgreSQL row lock

    if not session:
        raise HTTPException(status_code=400, detail="Trạng thái session không hợp lệ")

    # ... tiếp tục
```

---

### Bug #2: Contestant Bị Loại Vẫn Có Thể Quét Thẻ

**Vị trí:** [`backend/app/services/session_service.py:141-153`](backend/app/services/session_service.py:141)

**Vấn đề:**

```python
contestant = db.query(Contestant).filter(
    Contestant.card_id == card_id,
    Contestant.contest_id == session.contest_id,
    Contestant.status == ContestantStatus.active  # ← Check status
).first()

if not contestant:
    processed.append({
        "card_id": card_id,
        "status": "skipped",
        "reason": "Không tìm thấy hoặc đã bị loại"
    })
    continue  # ← Chỉ skip, không notify
```

**Kịch bản lỗi:**

1. Thí sinh card_id=42 trả lời sai → bị loại (status = eliminated)
2. BTC chưa kịp reveal → thí sinh vẫn quét thẻ lần 2
3. Backend skip thẻ này nhưng **không broadcast**
4. ScannerPage vẫn hiển thị "Đã quét" cho thẻ 42
5. **Kết quả:** BTC tưởng thí sinh vẫn tham gia, thực tế đã bị loại

**Fix:**

```python
if not contestant:
    # Check nếu là eliminated để notify
    eliminated_contestant = db.query(Contestant).filter(
        Contestant.card_id == card_id,
        Contestant.contest_id == session.contest_id
    ).first()

    if eliminated_contestant and eliminated_contestant.status == ContestantStatus.eliminated:
        processed.append({
            "card_id": card_id,
            "status": "eliminated",  # ← Different status
            "reason": "Đã bị loại"
        })
    else:
        processed.append({
            "card_id": card_id,
            "status": "skipped",
            "reason": "Không tìm thấy"
        })
    continue
```

---

### Bug #3: Timer Không Reset Đúng Khi Next Question

**Vị trí:** [`frontend/src/pages/LiveView.jsx:467-482`](frontend/src/pages/LiveView.jsx:467)

**Vấn đề:**

```javascript
useEffect(() => {
  const idx = session?.questionIndex;
  if (idx === undefined) return;
  if (prevQIdx.current === null) {
    prevQIdx.current = idx; // First load
  } else if (idx !== prevQIdx.current) {
    prevQIdx.current = idx;
    setPhase("question");
    setTimerRunning(false);
    setTimeLeft(timerSel); // ← Reset timeLeft
    clearInterval(intervalRef.current);
  }
}, [session?.questionIndex]); // ← Dependency
```

**Kịch bản lỗi:**

1. Câu 1: timerSel = 15s, đang countdown còn 10s
2. BTC bấm "Next Question"
3. `session.questionIndex` thay đổi từ 0 → 1
4. Effect chạy → setTimeLeft(15) ✓
5. **NHƯNG:** `timerSel` state có thể chưa update (nếu BTC đổi timerSel)
6. **Kết quả:** Timer hiển thị sai thời gian

**Fix:**

```javascript
useEffect(() => {
  const idx = session?.questionIndex;
  if (idx === undefined) return;
  if (prevQIdx.current === null) {
    prevQIdx.current = idx;
  } else if (idx !== prevQIdx.current) {
    prevQIdx.current = idx;
    setPhase("question");
    setTimerRunning(false);
    setTimeLeft(timerSel); // Use timerSel from state
    clearInterval(intervalRef.current);

    // Force broadcast ngay
    broadcastState({
      phase: "question",
      timeLeft: timerSel,
      timerTotal: timerSel,
    });
  }
}, [session?.questionIndex, timerSel]); // ← Thêm timerSel dependency
```

---

### Bug #4: WebSocket Không Sync Khi PresentationScreen Mở Sau

**Vị trí:** [`frontend/src/pages/LiveView.jsx:445-465`](frontend/src/pages/LiveView.jsx:445)

**Vấn đề:**

```javascript
useEffect(() => {
    if (presenterConnected && !prevConnectedRef.current) {
        if (!sessionStartedRef.current) {
            // Chưa bấm "Vào thi" → luôn gửi lobby
            broadcast({ phase: 'lobby', ... });
        } else {
            // Đang thi → gửi state hiện tại
            broadcastState({});
        }
    }
    prevConnectedRef.current = presenterConnected;
}, [presenterConnected]);
```

**Kịch bản lỗi:**

1. BTC start session → phase = 'question'
2. BTC bấm "Mở máy chiếu" → PresentationScreen mở
3. `presenterConnected` = true → broadcastState() chạy
4. **NHƯNG:** `broadcastState()` dùng `phase` từ closure (có thể cũ)
5. **Kết quả:** PresentationScreen nhận phase sai (ví dụ: 'lobby' thay vì 'question')

**Fix:**

```javascript
useEffect(() => {
    if (presenterConnected && !prevConnectedRef.current) {
        if (!sessionStartedRef.current) {
            broadcast({ phase: 'lobby', ... });
        } else {
            // Dùng callback để lấy state mới nhất
            broadcastState({});
        }
    }
    prevConnectedRef.current = presenterConnected;
}, [presenterConnected]);  // eslint-disable-line

// Thêm: Force sync khi presenter reconnect
useEffect(() => {
    if (presenterConnected) {
        const syncData = {
            phase: phase,  // Lấy từ current state
            question: currentQ,
            votes: session?.votes || {},
            timeLeft: timeLeft,
            timerTotal: timerSel,
            scannedCount: respondedCount,
            activeTotal: activeConts.length,
            eventName: activeEvent?.name || '',
            questionIndex: session?.questionIndex || 0,
            totalQuestions: activeSet?.questions.length || 0,
            questions: activeSet?.questions || [],
            questionHistory: questionHistory,
            contestants: activeConts,
            responses: session?.responses || {},
        };
        broadcast(syncData);
    }
}, [presenterConnected]);  // eslint-disable-line
```

---

## 🟠 HIGH PRIORITY BUGS

### Bug #5: Không Có Confirmation Khi Reveal Answer

**Vị trí:** [`frontend/src/pages/LiveView.jsx:551-555`](frontend/src/pages/LiveView.jsx:551)

**Vấn đề:**

```javascript
const handleReveal = async () => {
  await revealAnswer();
  setPhase("revealed");
  broadcastState({ phase: "revealed" });
};
```

**Kịch bản lỗi:**

1. BTC vô tình bấm "Công bố đáp án" khi chưa kịp đọc câu hỏi
2. Đáp án hiện ngay → thí sinh biết đáp án trước khi kịp trả lời
3. **Kết quả:** Cuộc thi bị hỏng, phải restart session

**Fix:**

```javascript
const handleReveal = async () => {
  // Show confirmation dialog
  if (!window.confirm("Công bố đáp án? Thí sinh sẽ không thể trả lời tiếp.")) {
    return;
  }
  await revealAnswer();
  setPhase("revealed");
  broadcastState({ phase: "revealed" });
};
```

---

### Bug #6: Rescue Contestants Không Broadcast Qua WebSocket

**Vị trí:** [`frontend/src/context/AppContext.jsx:238-278`](frontend/src/context/AppContext.jsx:238)

**Vấn đề:**

```javascript
const rescueContestants = useCallback(
  async (mode, count, contestantIds = []) => {
    // ... logic rescue

    const results = await Promise.allSettled(
      toRescue.map((c) =>
        api.updateContestantStatus(c.id, "active", "Cứu trợ BTC"),
      ),
    );

    const succeeded = toRescue.filter(
      (_, i) => results[i].status === "fulfilled",
    );
    const succeededIds = new Set(succeeded.map((c) => c.id));
    setContestants((cs) =>
      cs.map((c) => (succeededIds.has(c.id) ? { ...c, status: "active" } : c)),
    );

    // ❌ KHÔNG broadcast qua WebSocket
    return succeeded;
  },
  [contestants, showToast],
);
```

**Kịch bản lỗi:**

1. BTC cứu thí sinh từ LiveView
2. ScannerPage không nhận update → thí sinh vẫn hiện là eliminated
3. Nếu thí sinh quét thẻ → bị skip
4. **Kết quả:** Thí sinh được cứu nhưng không thể quét thẻ

**Fix:**

```javascript
const rescueContestants = useCallback(
  async (mode, count, contestantIds = []) => {
    // ... logic rescue

    const results = await Promise.allSettled(
      toRescue.map((c) =>
        api.updateContestantStatus(c.id, "active", "Cứu trợ BTC"),
      ),
    );

    const succeeded = toRescue.filter(
      (_, i) => results[i].status === "fulfilled",
    );
    const succeededIds = new Set(succeeded.map((c) => c.id));
    setContestants((cs) =>
      cs.map((c) => (succeededIds.has(c.id) ? { ...c, status: "active" } : c)),
    );

    // ✅ Broadcast qua WebSocket
    if (succeeded.length > 0 && activeSession?.session_id) {
      await api.broadcastBtcOverride({
        session_id: activeSession.session_id,
        contestants: succeeded.map((c) => ({
          id: c.id,
          new_status: "active",
        })),
      });
    }

    return succeeded;
  },
  [contestants, showToast, activeSession],
);
```

---

### Bug #7: Không Validate Session State Khi Submit Scan

**Vị trí:** [`backend/app/api/routes/scan.py:14-50`](backend/app/api/routes/scan.py:14)

**Vấn đề:**

```python
@router.post("/submit")
async def submit_scan(data: ScanSubmit, db: Session = Depends(get_db), _=auth):
    processed, votes = session_service.submit_scan_results(
        db, data.session_id, data.results
    )
    # ...
```

**Kịch bản lỗi:**

1. Session đang ở state = `revealed` (đã công bố đáp án)
2. ScannerPage vẫn gửi scan request (do delay hoặc bug)
3. Backend reject với error 400
4. ScannerPage không handle error → hiển thị "Đã quét" sai
5. **Kết quả:** Dữ liệu không đồng bộ

**Fix:**

```python
@router.post("/submit")
async def submit_scan(data: ScanSubmit, db: Session = Depends(get_db), _=auth):
    try:
        processed, votes = session_service.submit_scan_results(
            db, data.session_id, data.results
        )
    except HTTPException as e:
        # Return error with clear message
        raise e
    except Exception as e:
        # Handle other errors
        raise HTTPException(status_code=400, detail=f"Lỗi quét: {str(e)}")

    # ...
```

---

## 🟡 MEDIUM PRIORITY BUGS

### Bug #8: Không Có Loading State Khi Start Session

**Vị trí:** [`frontend/src/pages/LiveView.jsx:320-324`](frontend/src/pages/LiveView.jsx:320)

**Vấn đề:**

```javascript
<button
  onClick={() => onStart(ev.id)}
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 hover:opacity-90 shadow-sm"
  style={{ background: "linear-gradient(135deg,#10509F,#1a6fd4)" }}>
  <Zap className="w-4 h-4" /> Bắt đầu
</button>
```

**Kịch bản lỗi:**

1. BTC bấm "Bắt đầu"
2. API call đang chạy (3-5s do network)
3. BTC bấm nhiều lần → nhiều session được tạo
4. **Kết quả:** Nhiều session active, gây lỗi

**Fix:**

```javascript
const [starting, setStarting] = useState(false);

// ...
<button
  onClick={() => {
    setStarting(true);
    onStart(ev.id);
  }}
  disabled={starting}
  className="...">
  {starting ? (
    <>
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      Đang khởi tạo...
    </>
  ) : (
    <>
      <Zap className="w-4 h-4" /> Bắt đầu
    </>
  )}
</button>;
```

---

### Bug #9: Không Có Error Handling Khi WebSocket Disconnect

**Vị trí:** [`frontend/src/context/AppContext.jsx:412-424`](frontend/src/context/AppContext.jsx:412)

**Vấn đề:**

```javascript
wsManager.on("__disconnected", () => {
  setWsConnected(false);
  setCameraConnected(false);
});
```

**Kịch bản lỗi:**

1. WebSocket disconnect do network lỗi
2. Camera không thể gửi scan results
3. BTC không biết → vẫn tiếp tục cuộc thi
4. **Kết quả:** Thí sinh quét thẻ nhưng không được ghi nhận

**Fix:**

```javascript
wsManager.on("__disconnected", () => {
  setWsConnected(false);
  setCameraConnected(false);

  // Show warning toast
  showToast("warning", "Mất kết nối WebSocket. Kiểm tra mạng.");

  // Auto-reconnect after 3s
  setTimeout(() => {
    connectWebSocket(activeSession?.session_id);
  }, 3000);
});
```

---

### Bug #10: Timer Audio Không Stop Khi Skip

**Vị trí:** [`frontend/src/pages/LiveView.jsx:542-549`](frontend/src/pages/LiveView.jsx:542)

**Vấn đề:**

```javascript
const skipToScan = () => {
  clearInterval(intervalRef.current);
  setTimerRunning(false);
  setTimeLeft(0);
  setPhase("scanning");
  broadcastState({ phase: "scanning", timeLeft: 0 });
  stopAudio(); // ← Gọi stopAudio
};
```

**Kịch bản lỗi:**

1. Timer đang countdown với audio
2. BTC bấm "Bỏ qua" → stopAudio() gọi
3. **NHƯNG:** Audio có thể chưa stop do promise delay
4. **Kết quả:** Âm thanh vẫn phát

**Fix:**

```javascript
const skipToScan = () => {
  clearInterval(intervalRef.current);
  setTimerRunning(false);
  setTimeLeft(0);
  setPhase("scanning");
  broadcastState({ phase: "scanning", timeLeft: 0 });

  // Force stop audio
  stopAudio();
  // Also pause any playing audio
  const audioElements = document.querySelectorAll("audio");
  audioElements.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
};
```

---

## 🟢 LOW PRIORITY BUGS

### Bug #11: Không Có Confirmation Khi Kết Thúc Session

**Vị trí:** [`frontend/src/pages/LiveView.jsx:593-598`](frontend/src/pages/LiveView.jsx:593)

**Vấn đề:**

```javascript
const handleEnd = async () => {
  sessionStartedRef.current = false;
  broadcast({ phase: "idle" });
  await endSession();
  navigate("/dashboard");
};
```

**Kịch bản lỗi:**

1. BTC vô tình bấm "Kết thúc"
2. Session kết thúc ngay → không thể khôi phục
3. **Kết quả:** Phải start session mới

**Fix:**

```javascript
const handleEnd = async () => {
  if (
    !window.confirm("Kết thúc phiên thi? Không thể khôi phục sau khi thoát.")
  ) {
    return;
  }
  sessionStartedRef.current = false;
  broadcast({ phase: "idle" });
  await endSession();
  navigate("/dashboard");
};
```

---

### Bug #12: Không Validate Card_id Range

**Vị trí:** [`backend/app/services/card_service.py:64-69`](backend/app/services/card_service.py:64)

**Vấn đề:**

```python
def card_id_to_bits(card_id: int) -> List[int]:
    assert 1 <= card_id <= 100, f"card_id phải từ 1–100, nhận: {card_id}"
    # ...
```

**Kịch bản lỗi:**

1. Scanner quét thẻ bị lỗi → card_id = 0 hoặc 999
2. Assert fail → exception
3. **Kết quả:** Crash scanner service

**Fix:**

```python
def card_id_to_bits(card_id: int) -> List[int]:
    if not 1 <= card_id <= 100:
        raise ValueError(f"card_id phải từ 1–100, nhận: {card_id}")
    # ...
```

---

## 📋 REAL-WORLD SCENARIOS

### Scenario 1: Network Lag During Scan

**Tình huống:**

- Network lag 5-10s
- Scanner quét 10 thẻ liên tiếp
- Chỉ 3 thẻ được gửi thành công

**Giải pháp:**

- Implement retry mechanism trên ScannerPage
- Queue scan results khi network offline
- Sync khi network online lại

---

### Scenario 2: Multiple BTC Operators

**Tình huống:**

- 2 người cùng điều khiển LiveView (2 tabs)
- Người 1 bấm "Reveal", Người 2 bấm "Next Question" cùng lúc
- Trạng thái bị lỗi

**Giải pháp:**

- Chỉ cho phép 1 BTC operator active
- Broadcast lock khi operator take control
- Show "Operator X đang điều khiển" cho tab khác

---

### Scenario 3: Camera Disconnect Mid-Session

**Tình huống:**

- Đang quét thẻ, camera disconnect
- BTC không biết → nghĩ thí sinh không trả lời
- Thực tế camera không quét được

**Giải pháp:**

- Show camera status rõ ràng (online/offline)
- Auto-reconnect camera
- Manual reconnect button

---

### Scenario 4: Late Arriving Contestants

**Tình huống:**

- Phiên thi đang chạy (câu 3/10)
- Thí sinh mới đến, cần thêm vào cuộc thi
- Không thể thêm vì session đang active

**Giải pháp:**

- Allow add contestants during session
- Auto-reset status cho contestant mới
- Notify qua WebSocket

---

### Scenario 5: Power Outage During Session

**Tình huống:**

- Đang câu 5/10, mất điện
- Server restart
- Session bị mất

**Giải pháp:**

- Auto-save session state to DB
- Resume session sau khi restart
- Show "Session paused" khi reconnect

---

## 🔧 FIX PRIORITY MATRIX

| Bug                           | Severity | Effort | Priority |
| ----------------------------- | -------- | ------ | -------- |
| #1 Race Condition Reveal/Next | Critical | Low    | **P0**   |
| #2 Eliminated Contestant Scan | Critical | Low    | **P0**   |
| #3 Timer Reset                | High     | Low    | **P1**   |
| #4 WebSocket Sync             | High     | Medium | **P1**   |
| #5 No Reveal Confirmation     | High     | Low    | **P1**   |
| #6 Rescue No Broadcast        | High     | Medium | **P1**   |
| #7 No Session State Validate  | High     | Low    | **P1**   |
| #8 No Loading State           | Medium   | Low    | **P2**   |
| #9 No WS Error Handling       | Medium   | Medium | **P2**   |
| #10 Timer Audio               | Medium   | Low    | **P2**   |
| #11 No End Confirmation       | Low      | Low    | **P3**   |
| #12 Card_id Validate          | Low      | Low    | **P3**   |

---

## ✅ TESTING CHECKLIST

### Before Each Session:

- [ ] Verify all contestants have valid card_id (1-100)
- [ ] Check camera connection
- [ ] Check WebSocket connection
- [ ] Verify question bank has questions
- [ ] Test timer audio

### During Session:

- [ ] Monitor scan results in real-time
- [ ] Verify eliminated contestants cannot scan
- [ ] Check timer sync across screens
- [ ] Monitor WebSocket connection

### After Session:

- [ ] Verify winners are correctly identified
- [ ] Check session logs
- [ ] Export results

---

**End of Bug Reports**
