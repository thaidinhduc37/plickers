# Plickers Bug Tracker

## Overview

This document tracks all known bugs, issues, and potential improvements in the Plickers system.

---

## Bug Severity Definitions

| Severity     | Description                                        | Response Time   |
| ------------ | -------------------------------------------------- | --------------- |
| **Critical** | System crash, data loss, core functionality broken | Immediate       |
| **High**     | Major feature broken, no workaround                | Within 24 hours |
| **Medium**   | Minor feature broken, workaround available         | Within 1 week   |
| **Low**      | UI/UX issues, cosmetic problems                    | Next sprint     |

---

## Recent Fixes (v1.3.1)

### BUG-010: Database Schema Missing `is_backup` Column
**Severity**: Critical
**Status**: Fixed
**Component**: Database Migration

**Description**:
After adding the `is_backup` field to the Question model, the database schema was not updated, causing 500 Internal Server Error on `/api/banks` endpoint.

**Error**:
```
sqlite3.OperationalError: no such column: questions.is_backup
```

**Root Cause**:
Database migration was not run after adding the new column to the model.

**Fix Applied**:
1. Updated `backend/db/migrate.py` to add `is_backup` column to questions table
2. Ran migration: `python -m db.migrate`
3. Added SQLite-specific ALTER TABLE statement:
```sql
ALTER TABLE questions ADD COLUMN is_backup BOOLEAN DEFAULT 0
```

**Verification**:
```
python -m db.migrate
# Output: [OK] is_backup column already exists
```

---

## Known Bugs

### BUG-001: Race Condition in Scan Submission

**Severity**: Critical  
**Status**: Fixed  
**Component**: Backend (`scan.py`), Frontend (`pcard_detector.js`)

**Description**:
When multiple QR codes are scanned simultaneously, race conditions can cause:

- Duplicate responses for the same card
- Lost responses when scans overlap
- Incorrect vote counts

**Root Cause**:
No locking mechanism when processing scan submissions.

**Fix Applied**:

```python
# backend/app/services/card_service.py
scan_locks = asyncio.Lock()  # Per-card locking

async def submit_scan(card_id: str, response: str):
    async with scan_locks:  # Lock during processing
        # Process scan
```

**Test Case**:

```
1. Open 2 browser tabs
2. Submit scan for same card from both tabs simultaneously
3. Verify only one response is recorded
```

---

### BUG-002: Contestant Elimination Not Synced Immediately

**Severity**: High  
**Status**: Fixed  
**Component**: WebSocket (`manager.py`), Frontend (`AppContext.jsx`)

**Description**:
When a contestant is eliminated, other connected clients don't see the update immediately.

**Root Cause**:
Elimination broadcast was sent after DB commit, causing delay.

**Fix Applied**:

```python
# backend/app/services/session_service.py
# Broadcast BEFORE commit
await ws_manager.broadcast('contestants_eliminated', eliminated_data)
await db.commit()
```

**Test Case**:

```
1. Open 2 browser tabs with same session
2. Tab A reveals answer (eliminates contestants)
3. Verify Tab B shows eliminated contestants immediately
```

---

### BUG-003: Response Not Saved to DB on Reveal

**Severity**: High  
**Status**: Fixed  
**Component**: Backend (`session_service.py`)

**Description**:
When revealing answers, responses were not being saved to the database correctly.

**Root Cause**:
Transaction scope was incorrect - responses were added but not committed.

**Fix Applied**:

```python
# backend/app/services/session_service.py
async with db_session() as db:
    async with db.begin():
        # Save responses
        for card_id, resp in responses.items():
            db.add(Response(...))
        # Commit happens automatically at end of context
```

**Test Case**:

```
1. Start session, scan some responses
2. Reveal answer
3. Check database - responses should be saved
4. Restart server, reload session - responses should persist
```

---

### BUG-004: Rescue Doesn't Restore Points Correctly

**Severity**: Medium  
**Status**: Fixed  
**Component**: Backend (`contestant_service.py`)

**Description**:
When rescuing contestants, their points and elimination status were not restored correctly.

**Root Cause**:
Rescue logic only set `eliminated = False` but didn't restore points.

**Fix Applied**:

```python
# backend/app/services/contestant_service.py
async def rescue_contestants(contestant_ids: list, session_id: int):
    for contestant in rescued:
        contestant.eliminated = False
        contestant.points = calculate_points(contestant)  # Restore points
```

**Test Case**:

```
1. Start session, reveal answer (eliminate some contestants)
2. Use rescue feature to bring back eliminated contestants
3. Verify points are restored correctly
4. Continue session - rescued contestants can still answer
```

---

### BUG-005: UI Not Synced Across Multiple Tabs

**Severity**: Medium  
**Status**: Fixed  
**Component**: Frontend (`usePresentationChannel.js`, `AppContext.jsx`)

**Description**:
When multiple tabs are open for the same session, UI state is not synchronized.

**Root Cause**:
BroadcastChannel was not properly integrated with WebSocket updates.

**Fix Applied**:

```javascript
// frontend/src/hooks/usePresentationChannel.js
const channel = new BroadcastChannel("presentation_channel");

channel.onmessage = (event) => {
  if (event.data.type === "state_update") {
    syncState(event.data.state);
  }
};

// Also broadcast when local state changes
const broadcastState = (state) => {
  channel.postMessage({ type: "state_update", state });
};
```

**Test Case**:

```
1. Open 2 browser tabs with same session
2. Tab A changes phase (e.g., scanning -> revealed)
3. Verify Tab B shows same phase immediately
```

---

### BUG-006: Cannot Edit Question Bank Name

**Severity**: Medium  
**Status**: Fixed  
**Component**: Backend (`banks.py`, `bank_service.py`), Frontend (`Library.jsx`, `AppContext.jsx`)

**Description**:
Users could not edit the name of an existing question bank.

**Root Cause**:
No API endpoint for updating bank name.

**Fix Applied**:

```python
# backend/app/api/routes/banks.py
@router.patch("/{bank_id}")
async def update_bank(
    bank_id: str,
    bank_update: BankUpdate,
    db: Session = Depends(get_db)
):
    return await bank_service.update_bank(bank_id, bank_update)
```

**Test Case**:

```
1. Create a question bank
2. Try to edit the bank name
3. Verify name is updated in UI
4. Refresh page - name should persist
```

---

### BUG-007: Question Retry Feature Missing

**Severity**: High  
**Status**: Fixed  
**Component**: Backend (`session_service.py`, `session.py`), Frontend (`AppContext.jsx`, `LiveView.jsx`)

**Description**:
No way to retry a question without resetting the entire session.

**Root Cause**:
Feature was not implemented.

**Fix Applied**:

```python
# backend/app/services/session_service.py
async def retry_question(session_id: int):
    # 1. Restore contestants eliminated at current question
    await reset_contestants_at_question(current_index)
    # 2. Delete responses for current question
    await delete_responses_at_question(current_index)
    # 3. Reset phase to scanning
    session.phase = 'scanning'
```

**Test Case**:

```
1. Start session, answer a question, reveal
2. Click "Thi lại câu" (Retry)
3. Verify contestants are restored
4. Verify responses are cleared
5. Verify phase returns to scanning
```

---

### BUG-008: Question Skip Feature Missing

**Severity**: Medium  
**Status**: Fixed  
**Component**: Backend (`session_service.py`, `session.py`), Frontend (`AppContext.jsx`, `LiveView.jsx`)

**Description**:
No way to skip a question without answering it.

**Root Cause**:
Feature was not implemented.

**Fix Applied**:

```python
# backend/app/services/session_service.py
async def skip_question(session_id: int):
    # 1. Don't save responses, don't eliminate anyone
    # 2. Move to next question
    session.question_index += 1
    # 3. If more questions, go to question phase
    if session.question_index < total_questions:
        session.phase = 'question'
    else:
        session.phase = 'ended'
```

**Test Case**:

```
1. Start session, go to a question
2. Click "Bỏ qua câu" (Skip)
3. Verify no responses are saved
4. Verify no contestants are eliminated
5. Verify next question is loaded
```

---

### BUG-009: Backup Question Flag Missing

**Severity**: Low  
**Status**: Fixed  
**Component**: Backend (`models.py`, `schemas.py`, `banks.py`), Frontend (`Library.jsx`)

**Description**:
No way to mark questions as backup/draft that shouldn't be included in scoring.

**Root Cause**:
`is_backup` field was missing from Question model.

**Fix Applied**:

```python
# backend/app/models/models.py
class Question(Base):
    # ... other fields
    is_backup: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Test Case**:

```
1. Create a question, mark as backup
2. Add to contest
3. Verify backup questions are excluded from scoring
4. Toggle backup flag - verify it persists
```

---

## Potential Issues (To Be Tested)

### POTENTIAL-001: Memory Leak in Long Sessions

**Severity**: Medium  
**Status**: Investigating  
**Component**: Frontend (`LiveView.jsx`)

**Description**:
Sessions lasting longer than 1 hour may cause memory issues.

**Hypothesis**:
Event listeners or intervals not being cleaned up.

**Test Plan**:

```
1. Start a session
2. Keep it running for 2+ hours
3. Monitor memory usage
4. Check for memory leaks in DevTools
```

---

### POTENTIAL-002: Safari BroadcastChannel Support

**Severity**: Low  
**Status**: Not Tested  
**Component**: Frontend (`usePresentationChannel.js`)

**Description**:
BroadcastChannel API may not be supported in older Safari versions.

**Test Plan**:

```
1. Open session in Safari
2. Open presentation screen in another tab
3. Verify sync works
```

**Fallback Needed**:
If BroadcastChannel is not supported, use localStorage events or WebSocket for cross-tab sync.

---

### POTENTIAL-003: Load Test with 10,000 Contestants

**Severity**: Low  
**Status**: Not Tested  
**Component**: Backend (`session_service.py`), Frontend (`LiveView.jsx`)

**Description**:
System performance with large number of contestants is unknown.

**Test Plan**:

```
1. Create contest with 10,000 contestants
2. Start session
3. Measure render time
4. Measure WebSocket message size
5. Check for performance issues
```

---

## Bug Report Template

When reporting a new bug, use this template:

```markdown
## BUG-XXX: [Brief Title]

**Severity**: Critical/High/Medium/Low  
**Status**: New/In Progress/Fixed/Rejected  
**Component**: [Backend/Frontend/Database/Other]  
**Reporter**: [Name]  
**Date Reported**: [YYYY-MM-DD]

### Description

[Detailed description of the bug]

### Steps to Reproduce

1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior

[What should happen]

### Actual Behavior

[What actually happens]

### Environment

- Browser: [e.g., Chrome 120]
- OS: [e.g., Windows 11]
- Device: [e.g., Desktop, Mobile]
- Version: [e.g., v1.2.3]

### Screenshots/Logs

[Attach if applicable]

### Additional Context

[Any other relevant information]
```

---

## Fix Verification Checklist

For each bug fix, verify:

- [ ] Bug is reproducible before fix
- [ ] Fix resolves the issue
- [ ] No regression in other features
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Deployed to staging
- [ ] Verified in production

---

## Release Notes

### v1.3.0 (Current)

- Added Question Retry feature
- Added Question Skip feature
- Added Backup Question flag
- Fixed: Cannot edit question bank name
- Fixed: UI sync across multiple tabs

### v1.2.0

- Fixed: Race condition in scan submission
- Fixed: Contestant elimination not synced
- Fixed: Response not saved to DB

### v1.1.0

- Fixed: Rescue doesn't restore points

### v1.0.0

- Initial release

---

## Contact

For bug reports or questions, contact the development team.
