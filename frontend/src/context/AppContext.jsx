/**
 * src/context/AppContext.jsx
 * FIXED:
 *  #1 — WebSocket real-time: answer_received cập nhật responsesMap trực tiếp qua WS, không cần reload/poll
 *  #2 — Loại người sai: submitScan filter eliminated trước khi gửi; WS contestants_eliminated cập nhật ngay
 *  #4 — rescueContestants: cứu trợ theo 3 chế độ (random / manual / lọt sâu nhất)
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, wsManager } from '../api/client';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {

    const [banks, setBanks] = useState([]);
    const [contests, setContests] = useState([]);
    const [contestants, setContestants] = useState([]);
    const [activeSession, setActiveSession] = useState(null);
    const [votes, setVotes] = useState({ A: 0, B: 0, C: 0, D: 0, total: 0 });
    const [justEliminated, setJustEliminated] = useState([]);

    // responsesMap: { [card_id]: { answer, timestamp, contestant_name } }
    const responsesMapRef = useRef({});
    const [responsesMap, setResponsesMap] = useState({});

    const [wsConnected, setWsConnected] = useState(false);
    const [cameraConnected, setCameraConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    // ═════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═════════════════════════════════════════════════════════════════════════

    const showToast = useCallback((type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    }, []);

    const handleApiError = useCallback((e, fallback = 'Có lỗi xảy ra') => {
        const message = e?.message || e?.detail || fallback;
        console.error('[API Error]', message, e);
        showToast('error', message);
    }, [showToast]);

    const handleSuccess = useCallback((message) => showToast('success', message), [showToast]);

    // ═════════════════════════════════════════════════════════════════════════
    // BANKS
    // ═════════════════════════════════════════════════════════════════════════

    const fetchBanks = useCallback(async () => {
        try {
            const summaries = await api.getBanks();
            const full = await Promise.all(summaries.map(old => api.getBank(old.id).catch(() => old)));
            setBanks(full);
        } catch (e) { handleApiError(e, 'Không thể tải thư viện câu hỏi'); }
    }, [handleApiError]);

    const addBank = async (title, description = '') => {
        try {
            setLoading(true);
            const data = await api.createBank(title, description);
            setBanks(prev => [data, ...prev]);
            showToast('success', 'Đã tạo thư viện mới');
            return data;
        } catch (e) { handleApiError(e, 'Lỗi tạo thư viện'); return null; }
        finally { setLoading(false); }
    };

    const updateBank = async (bankId, title, description) => {
        try {
            setLoading(true);
            const updatedBank = await api.updateBank(bankId, title, description);
            setBanks(prev => prev.map(b => b.id === bankId ? updatedBank : b));
            showToast('success', 'Đã cập nhật thư viện');
            return updatedBank;
        } catch (e) { handleApiError(e, 'Lỗi cập nhật thư viện'); return null; }
        finally { setLoading(false); }
    };

    const removeBank = async (bankId) => {
        try {
            await api.deleteBank(bankId);
            setBanks(prev => prev.filter(b => b.id !== bankId));
            showToast('success', 'Đã xoá thư viện');
        } catch (e) { handleApiError(e, 'Lỗi xoá thư viện'); }
    };

    const addQuestionToBank = async (bankId, qData) => {
        try {
            const newQ = await api.addQuestionToBank(bankId, qData);
            setBanks(prev => prev.map(c =>
                c.id === bankId ? { ...c, questions: [...(c.questions || []), newQ] } : c
            ));
            showToast('success', 'Đã thêm câu hỏi vào thư viện');
            return true;
        } catch (e) { handleApiError(e, 'Lỗi thêm câu hỏi'); return false; }
    };

    const updateQuestionInBank = async (bankId, questionId, qData) => {
        try {
            const updatedQ = await api.updateQuestionInBank(bankId, questionId, qData);
            setBanks(prev => prev.map(b =>
                b.id === bankId
                    ? { ...b, questions: (b.questions || []).map(q => q.id === questionId ? updatedQ : q) }
                    : b
            ));
            showToast('success', 'Đã cập nhật câu hỏi');
            return true;
        } catch (e) { handleApiError(e, 'Lỗi cập nhật câu hỏi'); return false; }
    };

    const deleteQuestionFromBank = async (bankId, questionId) => {
        try {
            await api.deleteQuestionFromBank(bankId, questionId);
            setBanks(prev => prev.map(b =>
                b.id === bankId
                    ? { ...b, questions: (b.questions || []).filter(q => q.id !== questionId) }
                    : b
            ));
            showToast('success', 'Đã xoá câu hỏi khỏi thư viện');
            return true;
        } catch (e) { handleApiError(e, 'Lỗi xoá câu hỏi'); return false; }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // CONTESTS
    // ═════════════════════════════════════════════════════════════════════════

    const fetchContests = useCallback(async () => {
        try {
            const summaries = await api.getContests();
            const full = await Promise.all(summaries.map(c => api.getContest(c.id).catch(() => c)));
            setContests(full);
        } catch (e) { handleApiError(e, 'Không thể tải danh sách cuộc thi'); }
    }, []);

    const addContest = async (title, description = '', bank_id = null) => {
        try {
            setLoading(true);
            const data = await api.createContest(title, description, bank_id);
            setContests(prev => [data, ...prev]);
            showToast('success', 'Đã tạo cuộc thi mới');
            return data;
        } catch (e) { handleApiError(e, 'Lỗi tạo cuộc thi'); return null; }
        finally { setLoading(false); }
    };

    const deleteContest = async (contestId) => {
        try {
            await api.deleteContest(contestId);
            setContests(cs => cs.filter(c => c.id !== contestId));
            showToast('success', 'Đã xoá cuộc thi');
        } catch (e) { handleApiError(e, 'Không thể xoá cuộc thi'); }
    };

    const updateContest = async (contestId, title, description = '', bank_id = null, max_contestants = null) => {
        try {
            const updated = await api.updateContest(contestId, title, description, bank_id, max_contestants);
            setContests(cs => cs.map(c => c.id === contestId ? updated : c));
            showToast('success', 'Đã cập nhật cuộc thi');
            return updated;
        } catch (e) { handleApiError(e, 'Không thể cập nhật cuộc thi'); return null; }
    };

    const addQuestionToContest = async (contestId, question) => {
        try {
            const q = await api.addQuestion(contestId, question);
            setContests(cs => cs.map(c =>
                c.id === contestId ? { ...c, questions: [...(c.questions || []), q] } : c
            ));
            return q;
        } catch (e) { handleApiError(e, 'Không thể thêm câu hỏi'); return null; }
    };

    const bulkAddQuestionsToContest = async (contestId, questions) => {
        try {
            const added = await api.bulkAddQuestions(contestId, questions);
            await fetchContests();
            showToast('success', `Đã thêm ${added.length} câu hỏi`);
            return added;
        } catch (e) { handleApiError(e, 'Không thể thêm câu hỏi'); return []; }
    };

    const addSet = (name) => addContest(name);
    const updateQuestionInContest = async () => { await fetchContests(); };
    const deleteQuestionFromContest = async (contestId, questionId) => {
        setContests(cs => cs.map(c =>
            c.id === contestId ? { ...c, questions: (c.questions || []).filter(q => q.id !== questionId) } : c
        ));
    };
    const reorderQuestionsInContest = async (contestId, reordered) => {
        setContests(cs => cs.map(c => c.id === contestId ? { ...c, questions: reordered } : c));
    };

    // ═════════════════════════════════════════════════════════════════════════
    // CONTESTANTS
    // ═════════════════════════════════════════════════════════════════════════

    const fetchContestants = useCallback(async (contestId = null) => {
        try {
            const data = await api.getContestants(contestId);
            setContestants(data);
            return data;
        } catch (e) { handleApiError(e, 'Không thể tải danh sách thí sinh'); return []; }
    }, []);

    const importContestants = async (contestId, namesText) => {
        try {
            const created = await api.importContestants(contestId, namesText);
            await fetchContestants(contestId);
            showToast('success', `Đã thêm ${created.length} thí sinh`);
            return created;
        } catch (e) { handleApiError(e, 'Không thể import thí sinh'); return []; }
    };

    const updateContestantStatus = async (contestantId, status, note = '') => {
        try {
            const updated = await api.updateContestantStatus(contestantId, status, note);
            setContestants(cs => cs.map(c => c.id === contestantId ? updated : c));
            return updated;
        } catch (e) { handleApiError(e, 'Không thể cập nhật trạng thái'); return null; }
    };

    // ─── FIX #4: Cứu trợ ─────────────────────────────────────────────────────
    /**
     * rescueContestants(mode, count, contestantIds?)
     *
     * mode:
     *   'random'   — random `count` người từ danh sách bị loại
     *   'manual'   — cứu đúng những id trong `contestantIds`
     *   'deepest'  — lọt sâu nhất = sort theo correct_count (backend cần trả về field này)
     *
     * Trả về mảng contestant đã được cứu thành công.
     */
    const rescueContestants = useCallback(async (mode, count, contestantIds = []) => {
        const eliminated = contestants.filter(c => c.status === 'eliminated');
        if (eliminated.length === 0) {
            showToast('error', 'Không có ai bị loại để cứu trợ');
            return [];
        }

        let toRescue = [];

        if (mode === 'manual') {
            toRescue = eliminated.filter(c => contestantIds.includes(c.id)).slice(0, count);
        } else if (mode === 'deepest') {
            // Sắp xếp theo số câu đúng nhiều nhất (backend cần trả correct_count)
            const sorted = [...eliminated].sort((a, b) => (b.correct_count ?? 0) - (a.correct_count ?? 0));
            toRescue = sorted.slice(0, count);
        } else {
            // random
            const shuffled = [...eliminated].sort(() => Math.random() - 0.5);
            toRescue = shuffled.slice(0, count);
        }

        if (toRescue.length === 0) {
            showToast('error', 'Không tìm được thí sinh phù hợp');
            return [];
        }

        const results = await Promise.allSettled(
            toRescue.map(c => api.updateContestantStatus(c.id, 'active', 'Cứu trợ BTC'))
        );

        const succeeded = toRescue.filter((_, i) => results[i].status === 'fulfilled');
        const succeededIds = new Set(succeeded.map(c => c.id));
        setContestants(cs => cs.map(c =>
            succeededIds.has(c.id) ? { ...c, status: 'active' } : c
        ));

        if (succeeded.length > 0) showToast('success', `✅ Đã cứu trợ ${succeeded.length} thí sinh`);
        if (succeeded.length < toRescue.length) showToast('error', `${toRescue.length - succeeded.length} người không cứu được`);

        return succeeded;
    }, [contestants, showToast]);

    const setContestantStatus = (eventId, contestantId, status) => updateContestantStatus(contestantId, status);
    const resetContestants = async (contestId) => {
        try { await api.resetContestants(contestId); await fetchContestants(contestId); }
        catch (e) { handleApiError(e, 'Không thể reset trạng thái'); }
    };
    const addContestants = async (contestId, nameList) => importContestants(contestId, nameList.join('\n'));
    const removeContestant = async (eventId, contestantId) => {
        try {
            await api.deleteContestant(contestantId);
            setContestants(cs => cs.filter(c => c.id !== contestantId));
        } catch (e) { handleApiError(e, 'Không thể xóa thí sinh'); }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // SESSION
    // ═════════════════════════════════════════════════════════════════════════

    const fetchActiveSession = useCallback(async () => {
        try {
            const session = await api.getActiveSession();
            setActiveSession(session);
            if (session) {
                try {
                    const results = await api.getSessionResults(session.session_id);
                    if (results?.votes) setVotes({ ...results.votes });
                    // Sync responses khi reconnect (BTC mở lại tab)
                    if (results?.responses) {
                        responsesMapRef.current = results.responses;
                        setResponsesMap(results.responses);
                    }
                } catch (_) { }
            }
            return session;
        } catch (e) { setActiveSession(null); return null; }
    }, []);

    const startSession = async (contestId) => {
        setLoading(true);
        try {
            const session = await api.startSession(contestId);
            await fetchActiveSession();
            await fetchContestants(contestId);
            setVotes({ A: 0, B: 0, C: 0, D: 0, total: 0 });
            setJustEliminated([]);
            responsesMapRef.current = {};
            setResponsesMap({});
            connectWebSocket(session.id ?? session.session_id);
            handleSuccess('Phiên thi đã bắt đầu!');
            return session;
        } catch (e) { handleApiError(e, 'Không thể bắt đầu phiên thi'); return null; }
        finally { setLoading(false); }
    };

    // FIX #2: Filter eliminated trước khi gửi lên backend
    const submitScan = async (sessionId, results) => {
        try {
            const activeCardIds = new Set(
                contestants.filter(c => c.status === 'active').map(c => c.card_id)
            );
            const validResults = results.filter(r => activeCardIds.has(r.card_id));
            if (validResults.length === 0) return null;

            // Optimistic local update (không ghi đè nếu đã có)
            const newMap = { ...responsesMapRef.current };
            for (const r of validResults) {
                if (!newMap[r.card_id]) {
                    newMap[r.card_id] = { answer: r.answer, timestamp: new Date().toISOString() };
                }
            }
            responsesMapRef.current = newMap;
            setResponsesMap(newMap);

            return await api.submitScan(sessionId, validResults);
        } catch (e) { handleApiError(e, 'Không thể gửi câu trả lời'); return null; }
    };

    const revealAnswer = async () => {
        try {
            const result = await api.revealAnswer();
            setActiveSession(s => s ? { ...s, state: 'revealed' } : s);
            return result;
        } catch (e) { handleApiError(e, 'Không thể hiện đáp án'); return null; }
    };

    const nextQuestion = async () => {
        setJustEliminated([]);
        setVotes({ A: 0, B: 0, C: 0, D: 0, total: 0 });
        responsesMapRef.current = {};
        setResponsesMap({});
        try {
            const result = await api.nextQuestion();
            // Cập nhật activeSession ngay từ response để tránh phụ thuộc vào WebSocket
            if (result && result.current_question_index !== undefined) {
                setActiveSession(s => s ? {
                    ...s,
                    state: 'scanning',
                    current_question_index: result.current_question_index,
                    total_questions: result.total_questions,
                    current_question: result.current_question,
                    active_contestants: result.active_contestants,
                    scanned_count: 0,
                } : s);
            }
        }
        catch (e) { handleApiError(e, 'Không thể sang câu tiếp theo'); }
    };

    const endSession = async () => {
        try {
            const result = await api.endSession();
            wsManager.disconnect();
            setWsConnected(false);
            setCameraConnected(false);
            setActiveSession(null);
            setVotes({ A: 0, B: 0, C: 0, D: 0, total: 0 });
            responsesMapRef.current = {};
            setResponsesMap({});
            handleSuccess('Phiên thi đã kết thúc');
            return result;
        } catch (e) { handleApiError(e, 'Không thể kết thúc phiên thi'); return null; }
    };

    const clearResponses = useCallback(() => {
        setVotes({ A: 0, B: 0, C: 0, D: 0, total: 0 });
        responsesMapRef.current = {};
        setResponsesMap({});
    }, []);

    // ═════════════════════════════════════════════════════════════════════════
    // FIX #1: WEBSOCKET — real-time hoàn chỉnh, không cần polling
    // ═════════════════════════════════════════════════════════════════════════

    const connectWebSocket = useCallback((sessionId) => {
        wsManager.offAll();
        wsManager.disconnect();

        wsManager.on('__connected', () => {
            setWsConnected(true);
            setCameraConnected(true);
        });

        wsManager.on('__disconnected', () => {
            setWsConnected(false);
            setCameraConnected(false);
        });

        // FIX #1: Mỗi lần camera quét được thẻ → scan.py broadcast "answer_received"
        // → WS nhận → cập nhật responsesMap + votes ngay lập tức, không cần reload
        wsManager.on('answer_received', (data) => {
            const { card_id, answer, contestant_name, votes_snapshot, scanned_count } = data;

            setResponsesMap(prev => {
                if (prev[card_id]) return prev; // đã có đáp án, không ghi đè
                const next = {
                    ...prev,
                    [card_id]: { answer, timestamp: new Date().toISOString(), contestant_name },
                };
                responsesMapRef.current = next;
                return next;
            });

            if (votes_snapshot) {
                setVotes({
                    A: votes_snapshot.A || 0,
                    B: votes_snapshot.B || 0,
                    C: votes_snapshot.C || 0,
                    D: votes_snapshot.D || 0,
                    total: votes_snapshot.total || 0,
                });
            }

            setActiveSession(s => s ? { ...s, scanned_count } : s);
        });

        wsManager.on('question_changed', (data) => {
            // Reset hoàn toàn khi sang câu mới
            responsesMapRef.current = {};
            // Cập nhật tất cả cùng lúc để tránh race condition
            setVotes({ A: 0, B: 0, C: 0, D: 0, total: 0 });
            setResponsesMap({});
            setActiveSession(s => s ? {
                ...s,
                state: 'scanning',
                current_question_index: data.question_index,
                total_questions: data.total_questions,
                current_question: data.question,
                active_contestants: data.active_contestants,
                scanned_count: 0,
            } : s);
        });

        wsManager.on('answer_revealed', (data) => {
            setActiveSession(s => s ? { ...s, state: 'revealed', active_contestants: data.remaining_count } : s);
            if (data.votes) {
                const v = data.votes;
                setVotes({ ...v, total: (v.A || 0) + (v.B || 0) + (v.C || 0) + (v.D || 0) });
            }
        });

        // FIX #2: contestants_eliminated → cập nhật status ngay qua WS
        // ScannerPage đọc contestants từ context → submitScan sẽ tự lọc người bị loại
        wsManager.on('contestants_eliminated', (data) => {
            setJustEliminated(data.eliminated || []);
            const eliminatedIds = new Set((data.eliminated || []).map(e => e.id));
            setContestants(cs => cs.map(c =>
                eliminatedIds.has(c.id) ? { ...c, status: 'eliminated' } : c
            ));
        });

        wsManager.on('btc_override', (data) => {
            setContestants(cs => cs.map(c =>
                c.id === data.contestant_id ? { ...c, status: data.new_status } : c
            ));
        });

        wsManager.on('session_ended', (data) => {
            const winnerIds = new Set((data.winners || []).map(w => w.id));
            setContestants(cs => cs.map(c =>
                winnerIds.has(c.id) ? { ...c, status: 'winner' } : c
            ));
            setActiveSession(s => s ? { ...s, state: 'ended' } : s);
            showToast('success', `Kết thúc! ${data.winners?.length ?? 0} người thắng 🏆`);
        });

        wsManager.connect(sessionId);
    }, [showToast]);

    // ═════════════════════════════════════════════════════════════════════════
    // CARDS
    // ═════════════════════════════════════════════════════════════════════════

    const downloadContestCards = async (contestId) => {
        try { await api.downloadContestCards(contestId); }
        catch (e) { handleApiError(e, 'Không thể tải thẻ PDF'); }
    };
    const downloadBlankCards = async (count, startId = 1) => {
        try { await api.downloadBlankCards(count, startId); }
        catch (e) { handleApiError(e, 'Không thể tải thẻ PDF'); }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // SIMULATE (dev)
    // ═════════════════════════════════════════════════════════════════════════

    const simulateAnswer = async () => {
        if (!activeSession || activeSession.state !== 'scanning') return;
        const active = contestants.filter(c => c.status === 'active');
        if (!active.length) return;
        const c = active[Math.floor(Math.random() * active.length)];
        const answer = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
        try { await api.submitScan(activeSession.session_id, [{ card_id: c.card_id, answer }]); }
        catch (e) { console.warn('Simulate failed:', e); }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // KHỞI TẠO
    // ═════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        const initApp = async () => {
            try {
                const loginResult = await api.login('btc', 'rcv2024');
                if (!loginResult.ok) { showToast('error', 'Lỗi đăng nhập: ' + loginResult.error); return; }
            } catch (e) { handleApiError(e, 'Lỗi kết nối đến server'); return; }

            try {
                await fetchContests();
                await fetchBanks();
                const session = await fetchActiveSession();
                if (session) {
                    await fetchContestants(session.contest_id);
                    connectWebSocket(session.session_id);
                }
            } catch (e) { console.error('Init error:', e); }
        };

        initApp();
        return () => wsManager.disconnect();
    }, []);

    // ═════════════════════════════════════════════════════════════════════════
    // COMPAT MAPPING
    // ═════════════════════════════════════════════════════════════════════════

    const questionSets = contests.map(c => {
        const bank = banks.find(b => b.id === c.bank_id);
        const qs = bank?.questions || c.questions || [];
        return {
            id: c.bank_id,
            name: c.title,
            questions: [...qs].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).map(q => ({
                id: q.id, text: q.text,
                option_a: q.option_a, option_b: q.option_b,
                option_c: q.option_c, option_d: q.option_d,
                correct_answer: q.correct_answer, time_limit_sec: q.time_limit_sec,
            })),
        };
    });

    const events = contests.map(c => {
        const bank = banks.find(b => b.id === c.bank_id);
        return {
            id: c.id, name: c.title, setId: c.bank_id,
            question_count: (bank?.questions?.length) ?? c.question_count ?? 0,
            contestants: contestants
                .filter(cn => cn.contest_id === c.id)
                .map(cn => ({
                    id: cn.id, name: cn.name, card_id: cn.card_id,
                    status: cn.status,
                    correct_count: cn.correct_count ?? 0, // dùng cho "lọt sâu nhất"
                    assigned_card_id: cn.card_id,
                })),
        };
    });

    const session = activeSession ? {
        id: activeSession.session_id,
        eventId: activeSession.contest_id,
        questionIndex: activeSession.current_question_index,
        total_questions: activeSession.total_questions,
        current_question: activeSession.current_question,
        state: activeSession.state,
        votes,
        responses: responsesMap,
    } : null;

    const classes = contests.map(c => ({
        id: c.id, name: c.title,
        students: contestants
            .filter(cn => cn.contest_id === c.id)
            .map(cn => ({ id: cn.id, name: cn.name, assigned_card_id: cn.card_id })),
    }));

    const [activeClassId, setActiveClassId] = useState(null);
    const addClass = async (name, nameList = []) => {
        const contest = await addContest(name);
        if (contest && nameList.length) await importContestants(contest.id, nameList.join('\n'));
        return contest?.id;
    };
    const deleteClass = (classId) => deleteContest(classId);
    const addStudentsToClass = (classId, nameList) => importContestants(classId, nameList.join('\n'));
    const removeStudentFromClass = (classId, studentId) => removeContestant(classId, studentId);

    // ═════════════════════════════════════════════════════════════════════════
    // PROVIDE
    // ═════════════════════════════════════════════════════════════════════════

    const value = {
        banks, contests, contestants, activeSession,
        votes, responsesMap, justEliminated,
        wsConnected, cameraConnected, loading, toast,
        questionSets, events, session, classes, activeClassId,

        handleApiError, handleSuccess, showToast,

        fetchBanks, addBank, updateBank, removeBank,
        addQuestion: addQuestionToBank,
        updateQuestion: updateQuestionInBank,
        deleteQuestion: deleteQuestionFromBank,
        importQuestionsBulk: async (bId, listQ) => {
            try {
                setLoading(true);
                await api.bulkAddQuestionsToBank(bId, listQ);
                const fullB = await api.getBank(bId);
                setBanks(prev => prev.map(b => b.id === bId ? fullB : b));
                showToast('success', `Đã nhập ${listQ.length} câu hỏi`);
                return true;
            } catch (e) { handleApiError(e, 'Lỗi nhập hàng loạt'); return false; }
            finally { setLoading(false); }
        },

        fetchContests, createContest: addContest, updateContest, deleteContest,
        addQuestionToContest, bulkAddQuestionsToContest,
        addSet, updateQuestionInContest, deleteQuestionFromContest,
        reorderQuestionsInContest, deleteSet: deleteContest,

        fetchContestants, importContestants,
        updateContestantStatus, setContestantStatus,
        addContestants, removeContestant,
        addEvent: addContest,
        rescueContestants, // FIX #4 — dùng trong LiveView

        addClass, deleteClass, addStudentsToClass, removeStudentFromClass, setActiveClassId,

        fetchActiveSession, startSession, submitScan, resetContestants,
        revealAnswer, nextQuestion, endSession, clearResponses,
        connectWebSocket,
        downloadContestCards, downloadBlankCards,
        simulateAnswer,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
            {toast && (
                <div style={{ zIndex: 9999 }} className={[
                    'fixed bottom-6 left-1/2 -translate-x-1/2',
                    'flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl',
                    'text-sm font-semibold text-white pointer-events-none',
                    toast.type === 'success' ? 'bg-green-600' : 'bg-red-600',
                ].join(' ')}>
                    {toast.type === 'success' ? '✅' : '❌'} {toast.message}
                </div>
            )}
        </AppContext.Provider>
    );
}