/**
 * src/pages/LiveView.jsx — FINAL
 * Tích hợp đầy đủ BroadcastChannel → PresentationScreen
 * ĐÃ FIX: Đồng bộ ngay lập tức khi qua câu mới, thêm nút mở màn chiếu ở màn hình chờ,
 * tự động trả máy chiếu về Idle khi kết thúc.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale,
    BarElement, Tooltip, Legend
} from 'chart.js';
import { useApp } from '../context/AppContext';
import { usePresentationChannel } from '../hooks/usePresentationChannel';
import { useSessionPhase } from '../hooks/useSessionPhase';
import ContestantGrid from '../components/ContestantGrid';
import {
    Square, Eye, EyeOff, RefreshCw, Camera, CameraOff,
    ChevronRight, Radio, Zap, Users, CheckCircle2,
    Timer, Play, Pause, AlertTriangle, HeartHandshake,
    X, UserCheck, Monitor,
} from 'lucide-react';
import clsx from 'clsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ANSWER_COLORS = { A: '#E53E3E', B: '#3182CE', C: '#D69E2E', D: '#38A169' };
const ANSWER_KEYS   = ['A', 'B', 'C', 'D'];
const TIMER_OPTIONS = [10, 15, 20, 30, 45, 60];

// ─── Confirm end dialog ───────────────────────────────────────────────────────
function ConfirmEndDialog({ onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800 mb-1">Kết thúc phiên thi?</h2>
                    <p className="text-sm text-slate-500">Phiên thi sẽ kết thúc hoàn toàn. Không thể tiếp tục sau khi thoát.</p>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
                        Tiếp tục thi
                    </button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl">
                        Kết thúc
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Confirm reveal dialog ───────────────────────────────────────────────────────
// FIX #5: Dialog xác nhận trước khi công bố đáp án
function ConfirmRevealDialog({ onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                        <Eye className="w-6 h-6 text-amber-600" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800 mb-1">Công bố đáp án?</h2>
                    <p className="text-sm text-slate-500">Đáp án sẽ được hiển thị và thí sinh trả lời sai sẽ bị loại.</p>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
                        Hủy
                    </button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl">
                        Công bố
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Rescue Modal ─────────────────────────────────────────────────────────────
function RescueModal({ eliminated, onRescue, onClose, loading }) {
    const [mode, setMode] = useState('all'); // 'all' | 'count'
    const [count, setCount] = useState(1);

    // Always sort by correct_count descending
    const sorted = [...eliminated].sort((a, b) => (b.correct_count ?? 0) - (a.correct_count ?? 0));
    const toRescue = mode === 'all' ? sorted : sorted.slice(0, count);

    const handleConfirm = () => {
        if (!toRescue.length) return;
        onRescue('manual', toRescue.length, toRescue.map(c => c.id));
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                    style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
                            <HeartHandshake className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-green-900">Cứu trợ thí sinh</h2>
                            <p className="text-xs text-green-700">{eliminated.length} người đang bị loại</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chế độ cứu trợ</p>
                        <div className="flex gap-2">
                            <button onClick={() => setMode('all')}
                                className={clsx('flex-1 px-4 py-3 rounded-xl border-2 text-center transition-all',
                                    mode === 'all' ? 'border-green-500 bg-green-50 shadow-sm' : 'border-slate-200 hover:border-slate-300')}>
                                <p className="text-sm font-bold text-slate-800">Cứu tất cả</p>
                                <p className="text-xs text-slate-500">{eliminated.length} người</p>
                            </button>
                            <button onClick={() => setMode('count')}
                                className={clsx('flex-1 px-4 py-3 rounded-xl border-2 text-center transition-all',
                                    mode === 'count' ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 hover:border-slate-300')}>
                                <p className="text-sm font-bold text-slate-800">Số lượng cụ thể</p>
                                <p className="text-xs text-slate-500">Ưu tiên câu đúng nhiều nhất</p>
                            </button>
                        </div>
                    </div>

                    {mode === 'count' && (
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Số người cứu trợ</p>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setCount(c => Math.max(1, c - 1))}
                                    className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold text-lg">−</button>
                                <div className="flex-1 text-center">
                                    <span className="text-3xl font-extrabold text-slate-800">{count}</span>
                                    <span className="text-slate-400 text-sm ml-1">/ {eliminated.length} người</span>
                                </div>
                                <button onClick={() => setCount(c => Math.min(eliminated.length, c + 1))}
                                    className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold text-lg">+</button>
                            </div>
                            <div className="flex gap-2 mt-2 justify-center">
                                {[1,3,5,10].filter(n => n <= eliminated.length).map(n => (
                                    <button key={n} onClick={() => setCount(n)}
                                        className={clsx('px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                                            count === n ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Preview list */}
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                            Sẽ cứu {toRescue.length} thí sinh
                        </p>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                            {toRescue.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-3">Không có thí sinh</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {toRescue.map(c => (
                                        <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-green-100">
                                            <UserCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                                                <p className="text-[10px] text-slate-400">
                                                    Thẻ #{String(c.card_id).padStart(2,'0')}
                                                    {c.correct_count != null && ` · ${c.correct_count} câu đúng`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">Huỷ</button>
                        <button onClick={handleConfirm} disabled={loading || toRescue.length === 0}
                            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                            {loading
                                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang cứu...</>
                                : <><HeartHandshake className="w-4 h-4" /> Xác nhận cứu trợ</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Timer ring ───────────────────────────────────────────────────────────────
function TimerRing({ seconds, total, size = 140 }) {
    const r     = (size - 10) / 2;
    const circ  = 2 * Math.PI * r;
    const pct   = total > 0 ? seconds / total : 0;
    const dash  = circ * pct;
    const urgent = seconds <= 5 && seconds > 0;
    const color  = seconds === 0 ? '#ef4444' : urgent ? '#f97316' : '#10509F';
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
                <circle cx={size/2} cy={size/2} r={r} fill="none"
                    stroke={color} strokeWidth={8}
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.95s linear, stroke 0.3s' }} />
            </svg>
            <span className="absolute font-extrabold" style={{ fontSize: size * 0.22, color, transition: 'color 0.3s' }}>
                {seconds}
            </span>
        </div>
    );
}

// ─── No session screen ────────────────────────────────────────────────────────
// Truyền thêm openPresentation và presenterConnected
function NoSession({ events, onStart, openPresentation, presenterConnected, loading }) {
    return (
        <div className="flex flex-col h-full items-center justify-center bg-slate-50 p-8">
            <div className="w-full max-w-xl">
                <div className="text-center mb-8">
                    <div className="inline-flex w-20 h-20 rounded-2xl items-center justify-center mb-5 shadow-lg"
                        style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                        <Radio className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Bắt đầu phiên thi</h2>
                    <p className="text-slate-500 text-sm">Chọn một cuộc thi để bắt đầu điều khiển và trình chiếu.</p>
                </div>
                {events.length === 0 ? (
                    <div className="text-center py-8 px-6 bg-amber-50 border border-amber-200 rounded-2xl">
                        <p className="text-amber-700 font-semibold">⚠️ Chưa có cuộc thi nào</p>
                        <p className="text-amber-600 text-sm mt-1">Hãy tạo cuộc thi trong trang <strong>Cuộc thi</strong>.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map(ev => {
                            const active = ev.contestants.filter(c => c.status === 'active').length;
                            const total  = ev.contestants.length;
                            return (
                                <div key={ev.id}
                                    className="flex items-center gap-4 w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-lg transition-all group">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                                        style={{ background: 'linear-gradient(135deg,#EAB308,#f59e0b)' }}>
                                        <Radio className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 text-base truncate">{ev.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            <span className="text-green-600 font-semibold">{active}</span>/{total} thí sinh
                                            &nbsp;·&nbsp;{ev.question_count} câu hỏi
                                        </p>
                                    </div>
                                    
                                    {/* THÊM NÚT MỞ MÁY CHIẾU NGAY CẠNH NÚT BẮT ĐẦU */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openPresentation(); }}
                                            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-all',
                                                presenterConnected ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            )}>
                                            <Monitor className="w-4 h-4" />
                                            {presenterConnected ? 'Đang chiếu' : 'Mở máy chiếu'}
                                        </button>
                                        <button onClick={() => onStart(ev.id)}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                                            {loading ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Đang khởi tạo...
                                                </>
                                            ) : (
                                                <>
                                                    <Zap className="w-4 h-4" /> Bắt đầu
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Backup Question Picker Modal ─────────────────────────────────────────────
function BackupQuestionPicker({ backupQuestions, usedBackupIds, onSelect, onClose, loading }) {
    const available = backupQuestions.filter(q => !usedBackupIds.includes(q.id));
    const used = backupQuestions.filter(q => usedBackupIds.includes(q.id));

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                    style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-amber-900">Chọn câu dự phòng</h2>
                            <p className="text-xs text-amber-700">{available.length} câu có sẵn · {used.length} đã dùng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 max-h-[50vh] overflow-y-auto space-y-2">
                    {backupQuestions.length === 0 ? (
                        <div className="text-center py-8 px-6 bg-slate-50 rounded-xl">
                            <p className="text-slate-500 font-semibold">Chưa có câu dự phòng</p>
                            <p className="text-slate-400 text-sm mt-1">Đánh dấu câu dự phòng trong Ngân hàng câu hỏi.</p>
                        </div>
                    ) : available.length === 0 ? (
                        <div className="text-center py-8 px-6 bg-amber-50 rounded-xl">
                            <p className="text-amber-700 font-semibold">Đã dùng hết câu dự phòng!</p>
                        </div>
                    ) : (
                        available.map(q => (
                            <button
                                key={q.id}
                                onClick={() => onSelect(q.id)}
                                disabled={loading}
                                className="w-full text-left px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 transition-all disabled:opacity-50"
                            >
                                <p className="text-sm font-bold text-slate-800 line-clamp-2">{q.text}</p>
                                <div className="flex gap-2 mt-1.5 text-xs text-slate-500">
                                    <span>A: {q.option_a}</span>
                                    <span>·</span>
                                    <span>Đáp án: <strong className="text-green-600">{q.correct_answer}</strong></span>
                                </div>
                            </button>
                        ))
                    )}
                    {used.length > 0 && (
                        <>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Đã sử dụng</div>
                            {used.map(q => (
                                <div key={q.id} className="px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 opacity-50">
                                    <p className="text-sm text-slate-500 line-clamp-1">{q.text}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Đã dùng</p>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="px-6 pb-5 pt-2">
                    <button onClick={onClose}
                        className="w-full py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                        Huỷ
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LIVEVIEW
// ═══════════════════════════════════════════════════════════════════════════════
export default function LiveView() {
    const {
        questionSets, events, session, contestants,
        startSession, endSession, nextQuestion, revealAnswer, clearResponses, simulateAnswer,
        cameraConnected, fetchActiveSession, fetchContestants, fetchBanks, fetchContests,
        rescueContestants, useBackupQuestion, loading,
    } = useApp();
    // ── BroadcastChannel ───────────────────────────────────────────────────────
    const { broadcast, openPresentation, connected: presenterConnected } = usePresentationChannel('sender');

    // ── Derived values ─────────────────────────────────────────────────────────
    const activeEvent    = events.find(e => e.id === session?.eventId);
    const activeSet      = questionSets.find(s => s.id === activeEvent?.setId);
    // BUG C FIX: fallback sang session.current_question khi banks chưa load xong
    const currentQ       = activeSet?.questions[session?.questionIndex ?? 0]
                        ?? session?.current_question
                        ?? null;
    const activeConts    = activeEvent?.contestants.filter(c => c.status === 'active')    ?? [];
    const eliminatedConts= activeEvent?.contestants.filter(c => c.status === 'eliminated') ?? [];
    const respondedCount = Object.keys(session?.responses || {}).length;

    // ── Fetch on mount ─────────────────────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            await fetchBanks?.();
            await fetchContests?.();
            const s = await fetchActiveSession?.();
            if (s?.contest_id) await fetchContestants?.(s.contest_id);
        };
        init();
    }, []);

    // ── Phase state machine ────────────────────────────────────────────────────
    const {
        phase, setPhase,
        timerSel, setTimerSel,
        timeLeft, setTimeLeft,
        timerRunning,
        showConfirmEnd, setShowConfirmEnd,
        showRescue, setShowRescue,
        showRevealConfirm, setShowRevealConfirm,
        showBackupPicker, setShowBackupPicker,
        rescueLoading,
        totalVotes,
        isRevealed,
        broadcastState,
        handleStartFromLobby,
        startTimer,
        togglePause,
        skipToScan,
        handleReveal,
        confirmReveal,
        handleNext,
        handleEnd,
        handleRescue,
        handleUseBackup,
        retryQuestion,
    } = useSessionPhase({
        session,
        activeEvent,
        activeSet,
        currentQ,
        activeConts,
        eliminatedConts,
        respondedCount,
        events,
        revealAnswer,
        nextQuestion,
        endSession,
        clearResponses,
        rescueContestants,
        useBackupQuestion,
        broadcast,
        presenterConnected,
    });

    if (!session) return (
        <NoSession
            events={events}
            onStart={startSession}
            openPresentation={openPresentation}
            presenterConnected={presenterConnected}
            loading={loading}
        />
    );

    // ── Chart config ───────────────────────────────────────────────────────────
    const chartData = {
        labels: ANSWER_KEYS,
        datasets: [{
            label: 'Phiếu',
            data: ANSWER_KEYS.map(k => session.votes?.[k] || 0),
            backgroundColor: ANSWER_KEYS.map(k =>
                isRevealed ? (k === currentQ?.correct_answer ? '#22c55e' : '#fca5a5') : ANSWER_COLORS[k]
            ),
            borderRadius: 8, borderSkipped: false,
        }],
    };
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: '#f1f5f9' } },
            x: { ticks: { font: { size: 16, weight: 'bold' }, color: '#1e293b' }, grid: { display: false } },
        },
        animation: { duration: 400 },
    };

    const getTileStyle = (c) => {
        const raw      = session?.responses?.[c.card_id];
        const hasVoted = typeof raw === 'object' ? raw?.answer : raw;
        if (c.status === 'eliminated') return { bg: '#e2e8f0', color: '#94a3b8', ring: 'transparent' };
        if (c.status === 'winner')     return { bg: '#EAB308', color: '#fff',    ring: '#ca8a04'     };
        if (hasVoted) {
            if (phase === 'countdown' || phase === 'scanning')
                return { bg: ANSWER_COLORS[hasVoted], color: '#fff', ring: ANSWER_COLORS[hasVoted] };
            if (isRevealed) {
                const ok = hasVoted === currentQ?.correct_answer;
                return { bg: ok ? '#22c55e' : '#ef4444', color: '#fff', ring: ok ? '#16a34a' : '#dc2626' };
            }
        }
        return { bg: '#f1f5f9', color: '#94a3b8', ring: 'transparent' };
    };

    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full bg-slate-50">

            {/* ── TOP BAR ──────────────────────────────────────────────────── */}
            <header className="bg-white border-b border-slate-200 px-3 md:px-6 flex items-center gap-2 md:gap-4 shrink-0 shadow-sm" style={{ minHeight: 56 }}>

                {/* Room ID */}
                <div className="hidden md:flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 shrink-0">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">ID PHÒNG:</span>
                    <span className="text-sm font-bold text-indigo-700 font-mono tracking-wider">{session.id}</span>
                </div>

                {/* Câu số */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-bold shrink-0">
                    <span style={{ color: '#10509F' }}>{(session.questionIndex ?? 0) + 1}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-600">{activeSet?.questions.length || session.total_questions || '?'}</span>
                </div>

                {/* Câu hỏi */}
                <p className="flex-1 text-base font-bold text-slate-900 line-clamp-2 min-w-0 border-l border-slate-200 pl-4">
                    {currentQ?.text || <span className="text-slate-400 italic">Đang tải...</span>}
                </p>

                {/* Phase badge */}
                <div className={clsx('px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border', {
                    'bg-blue-50   text-blue-700   border-blue-200':   phase === 'question',
                    'bg-orange-50 text-orange-700 border-orange-200': phase === 'countdown',
                    'bg-purple-50 text-purple-700 border-purple-200': phase === 'scanning',
                    'bg-green-50  text-green-700  border-green-200':  phase === 'revealed',
                })}>
                    {phase === 'question'  && '📋 Đọc câu hỏi'}
                    {phase === 'countdown' && '⏱ Đang đếm giờ'}
                    {phase === 'scanning'  && '📡 Đang quét thẻ'}
                    {phase === 'revealed'  && '✅ Đã công bố'}
                </div>

                {/* Camera status */}
                <div className={clsx('hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0',
                    cameraConnected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400')}>
                    {cameraConnected
                        ? <><Camera className="w-3.5 h-3.5" />Online</>
                        : <><CameraOff className="w-3.5 h-3.5" />Chưa kết nối</>}
                </div>

                {/* ── NÚT MỞ MÀN HÌNH CHIẾU ── */}
                <button
                    onClick={openPresentation}
                    title="Mở cửa sổ màn hình chiếu → kéo sang tivi/projector → F11 fullscreen"
                    className={clsx(
                        'hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0',
                        presenterConnected
                            ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                            : 'text-slate-500 hover:bg-slate-100 border-slate-200'
                    )}>
                    <Monitor className="w-3.5 h-3.5" />
                    {presenterConnected
                        ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> Chiếu: Online</>
                        : 'Mở màn hình chiếu'}
                </button>

                <button onClick={simulateAnswer}
                    className="hidden md:block px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                    + Giả lập
                </button>

                <button onClick={() => setShowConfirmEnd(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg border border-transparent transition-all shrink-0">
                    <Square className="w-4 h-4 fill-current" /> Kết thúc
                </button>
            </header>

            {/* ── ANSWER OPTIONS BAR ───────────────────────────────────────── */}
            <div className="bg-white border-b border-slate-100 px-3 md:px-6 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
                {ANSWER_KEYS.map(k => {
                    const fk  = `option_${k.toLowerCase()}`;
                    const isC = k === currentQ?.correct_answer;
                    const v   = session?.votes?.[k] || 0;
                    const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                    return (
                        <div key={k} className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all shrink-0',
                            isRevealed && isC  ? 'bg-green-50 border-green-300 text-green-800 ring-2 ring-green-200'
                                : isRevealed   ? 'opacity-40 border-slate-200 text-slate-400'
                                               : 'border-slate-200 text-slate-700'
                        )}>
                            <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-white shrink-0"
                                style={{ backgroundColor: ANSWER_COLORS[k] }}>{k}</span>
                            <span className="max-w-[180px] truncate">{currentQ?.[fk] || `Đáp án ${k}`}</span>
                            {isRevealed && (
                                <span className={clsx('text-xs font-bold ml-1', isC ? 'text-green-700' : 'text-slate-400')}>
                                    {v} ({pct}%)
                                </span>
                            )}
                        </div>
                    );
                })}
                <div className="ml-auto flex items-center gap-2 text-sm font-bold text-slate-500 shrink-0">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-xl font-extrabold" style={{ color: '#10509F' }}>{respondedCount}</span>
                    <span className="text-slate-400">/ {activeConts.length}</span>
                </div>
            </div>

            {/* ── MAIN SPLIT ───────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">



                {/* ── Content area ── */}
                <div className={clsx(
                    'bg-white overflow-y-auto flex flex-col',
                    (phase === 'question' || phase === 'countdown' || phase === 'lobby') ? 'flex-1' : 'flex-[2] border-r border-slate-200'
                )}>

                    {/* PHASE: lobby */}
                    {phase === 'lobby' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-12 py-10">
                            <div className="text-center">
                                <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4 shadow-lg"
                                    style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-800 mb-1">{activeEvent?.name || 'Cuộc thi'}</h2>
                                <p className="text-slate-500 text-sm">Kiểm tra kết nối trước khi bắt đầu</p>
                            </div>

                            <div className="w-full max-w-lg space-y-3">
                                {/* Camera status */}
                                <div className={clsx(
                                    'flex items-center gap-4 px-5 py-4 rounded-2xl border-2 transition-all',
                                    cameraConnected ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'
                                )}>
                                    {cameraConnected
                                        ? <Camera className="w-5 h-5 text-green-600 shrink-0" />
                                        : <CameraOff className="w-5 h-5 text-amber-600 shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                        <p className={clsx('font-bold text-sm', cameraConnected ? 'text-green-800' : 'text-amber-800')}>
                                            Camera: {cameraConnected ? 'Đã kết nối' : 'Chưa kết nối'}
                                        </p>
                                        <p className={clsx('text-xs', cameraConnected ? 'text-green-600' : 'text-amber-600')}>
                                            {cameraConnected ? 'Thiết bị quét thẻ đang online' : 'Vào trang Quét thẻ để kết nối'}
                                        </p>
                                    </div>
                                </div>

                                {/* Presenter status */}
                                <div className={clsx(
                                    'flex items-center gap-4 px-5 py-4 rounded-2xl border-2',
                                    presenterConnected ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'
                                )}>
                                    <Monitor className={clsx('w-5 h-5 shrink-0', presenterConnected ? 'text-green-600' : 'text-slate-400')} />
                                    <div className="flex-1 min-w-0">
                                        <p className={clsx('font-bold text-sm', presenterConnected ? 'text-green-800' : 'text-slate-600')}>
                                            Màn hình chiếu: {presenterConnected ? 'Đang chiếu' : 'Chưa kết nối'}
                                        </p>
                                        {!presenterConnected && <p className="text-xs text-slate-400">Bấm &quot;Mở màn hình chiếu&quot; bên trên</p>}
                                    </div>
                                    {!presenterConnected && (
                                        <button onClick={openPresentation}
                                            className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-500 shrink-0">
                                            Mở
                                        </button>
                                    )}
                                </div>

                                {/* Contestant count */}
                                <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 bg-slate-50 border-slate-200">
                                    <Users className="w-5 h-5 text-slate-500 shrink-0" />
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">
                                            {activeConts.length} thí sinh · {activeSet?.questions.length || session?.total_questions || '?'} câu hỏi
                                        </p>
                                        <p className="text-xs text-slate-400">{eliminatedConts.length} đã bị loại</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleStartFromLobby}
                                className="flex items-center gap-2 px-10 py-3.5 text-white font-bold rounded-full text-base shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all"
                                style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                                <Play className="w-5 h-5" /> Bắt đầu thi từ Câu 1
                            </button>
                        </div>
                    )}

                    {/* PHASE: question */}
                    {phase === 'question' && (
                        <div className="flex-1 flex flex-col items-center justify-center px-12 py-8 gap-7 max-w-5xl mx-auto w-full">
                            <p className="text-[1.6rem] font-extrabold text-slate-900 text-center leading-snug">{currentQ?.text}</p>
                            <div className="grid grid-cols-2 gap-5 w-full">
                                {ANSWER_KEYS.map(k => (
                                    <div key={k} className="flex items-center gap-5 p-5 rounded-2xl border-2 bg-slate-50 shadow-sm"
                                        style={{ borderColor: ANSWER_COLORS[k] + '55' }}>
                                        <span className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-md"
                                            style={{ backgroundColor: ANSWER_COLORS[k] }}>{k}</span>
                                        <span className="text-base font-semibold text-slate-700 leading-snug">
                                            {currentQ?.[`option_${k.toLowerCase()}`] || `Đáp án ${k}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col items-center gap-3">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thời gian trả lời</p>
                                <div className="flex gap-2">
                                    {TIMER_OPTIONS.map(t => (
                                        <button key={t} onClick={() => { setTimerSel(t); setTimeLeft(t); }}
                                            className={clsx('w-14 h-14 rounded-full text-sm font-extrabold border-2 transition-all shadow-sm',
                                                timerSel === t ? 'text-white border-blue-600 shadow-md scale-110' : 'border-slate-200 text-slate-500 hover:border-blue-300 bg-white'
                                            )}
                                            style={timerSel === t ? { background: 'linear-gradient(135deg,#10509F,#1a6fd4)' } : {}}>
                                            {t}s
                                        </button>
                                    ))}
                                </div>
                                <button onClick={startTimer}
                                    className="flex items-center gap-2 px-10 py-3 text-white font-bold rounded-full text-base shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all mt-1"
                                    style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                                    <Timer className="w-5 h-5" /> Bắt đầu {timerSel}s
                                </button>
                            </div>
                        </div>
                    )}

                    {/* PHASE: countdown */}
                    {phase === 'countdown' && (
                        <div className="flex-1 flex flex-col items-center justify-center px-12 py-8 gap-7 max-w-5xl mx-auto w-full relative">
                            <div className="absolute top-5 right-6 flex flex-col items-center gap-1">
                                <TimerRing seconds={timeLeft} total={timerSel} size={100} />
                                <p className={clsx('text-xs font-bold text-center', timeLeft <= 5 ? 'text-red-600 animate-pulse' : 'text-slate-400')}>
                                    {timeLeft > 0 ? 'Đang đếm...' : '⏰ Hết giờ!'}
                                </p>
                            </div>
                            <p className="text-[1.6rem] font-extrabold text-slate-900 text-center leading-snug">{currentQ?.text}</p>
                            <div className="grid grid-cols-2 gap-5 w-full">
                                {ANSWER_KEYS.map(k => (
                                    <div key={k} className="flex items-center gap-5 p-5 rounded-2xl border-2 bg-slate-50 shadow-sm"
                                        style={{ borderColor: ANSWER_COLORS[k] + '55' }}>
                                        <span className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black text-white shrink-0 shadow-md"
                                            style={{ backgroundColor: ANSWER_COLORS[k] }}>{k}</span>
                                        <span className="text-base font-semibold text-slate-700 leading-snug">
                                            {currentQ?.[`option_${k.toLowerCase()}`] || `Đáp án ${k}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PHASE: scanning */}
                    {phase === 'scanning' && (
                        <div className="flex-1 flex flex-col p-5">
                            <div className="flex items-center gap-3 mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                    <Camera className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-purple-800">Giai đoạn quét thẻ</p>
                                    <p className="text-xs text-purple-600">BTC quét lần lượt từng thẻ.</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xl font-extrabold text-purple-700">{respondedCount}</p>
                                    <p className="text-xs text-purple-500">/ {activeConts.length} đã quét</p>
                                </div>
                            </div>
                            <ContestantGrid
                                contestants={activeEvent?.contestants || []}
                                columns={8}
                                renderCard={(c) => {
                                    const s = getTileStyle(c);
                                    const votedRaw = session?.responses?.[c.card_id];
                                    const voted = typeof votedRaw === 'object' ? votedRaw?.answer : votedRaw;
                                    return (
                                        <div
                                            className="rounded-lg p-2 flex flex-col items-center justify-center aspect-[6/1] transition-all duration-300 hover:scale-110 shadow-sm border-2"
                                            style={{
                                                backgroundColor: s.bg,
                                                color: s.color,
                                                borderColor: s.ring,
                                            }}
                                            title={`${c.name} (#${c.card_id})${voted ? ` → ${voted}` : ' — chưa quét'}`}
                                        >
                                            <span className="text-sm font-extrabold leading-tight">#{String(c.card_id).padStart(2, '0')}</span>
                                            <span className="text-xs font-medium leading-tight mt-0.5 truncate w-full text-center px-0.5">{c.name}</span>
                                            {voted && <span className="text-sm font-black leading-tight mt-0.5">{voted}</span>}
                                        </div>
                                    );
                                }}
                            />
                        </div>
                    )}

                    {/* PHASE: revealed */}
                    {phase === 'revealed' && (
                        <div className="flex-1 flex flex-col p-5">
                            <div className="flex items-center gap-3 mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-green-800">Đáp án đã được công bố</p>
                                    <p className="text-xs text-green-600">
                                        Đáp án đúng: <strong>{currentQ?.correct_answer}</strong>
                                        {currentQ?.[`option_${currentQ?.correct_answer?.toLowerCase()}`] && (
                                            <> — {currentQ[`option_${currentQ.correct_answer.toLowerCase()}`]}</>
                                        )}
                                    </p>
                                </div>
                                {eliminatedConts.length > 0 && (
                                    <button onClick={() => setShowRescue(true)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-all shadow-sm shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                                        <HeartHandshake className="w-4 h-4" />
                                        Cứu trợ
                                        <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{eliminatedConts.length}</span>
                                    </button>
                                )}
                            </div>
                            <ContestantGrid
                                contestants={activeEvent?.contestants || []}
                                columns={8}
                                renderCard={(c) => {
                                    const s = getTileStyle(c);
                                    return (
                                        <div
                                            className="rounded-lg p-2 flex flex-col items-center justify-center aspect-[6/1] shadow-sm border-2"
                                            style={{
                                                backgroundColor: s.bg,
                                                color: s.color,
                                                borderColor: s.ring,
                                            }}
                                            title={(() => {
                                                const r = session?.responses?.[c.card_id];
                                                const a = typeof r === 'object' ? r?.answer : r;
                                                return `${c.name}: ${a || 'không trả lời'}`;
                                            })()}
                                        >
                                            <span className="text-sm font-extrabold leading-tight">#{String(c.card_id).padStart(2, '00')}</span>
                                            <span className="text-xs font-medium leading-tight mt-0.5 truncate w-full text-center px-0.5">{c.name}</span>
                                        </div>
                                    );
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Vote Stats (scanning / revealed) ── */}
                {(phase === 'scanning' || phase === 'revealed') && (
                    <div className="hidden md:flex flex-[0.35] flex-col overflow-hidden border-l border-slate-200 p-4 bg-white">
                        {isRevealed && currentQ && (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-800 rounded-lg font-bold text-xs border border-green-200 mb-4 shrink-0">
                                <CheckCircle2 className="w-4 h-4" /> Đúng: <span className="text-sm font-black">{currentQ.correct_answer}</span>
                            </div>
                        )}
                        <div className="text-xs font-semibold bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-slate-500 mb-4 shrink-0">
                            <span className="text-green-600 font-extrabold">{activeConts.length}</span> đang thi
                            {eliminatedConts.length > 0 && <span className="ml-1.5 text-red-500 font-bold">· {eliminatedConts.length} loại</span>}
                        </div>

                        {/* Vote results table */}
                        <div className="flex-1 flex flex-col gap-3 justify-start">
                            {ANSWER_KEYS.map(k => {
                                const v   = session?.votes?.[k] || 0;
                                const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                                const isC = k === currentQ?.correct_answer;
                                return (
                                    <div key={k} className={clsx(
                                        'p-3 rounded-lg border-2 transition-all',
                                        isRevealed && isC
                                            ? 'bg-green-50 border-green-300'
                                            : isRevealed && !isC
                                            ? 'bg-slate-100 border-slate-300'
                                            : 'bg-slate-50 border-slate-200'
                                    )}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm" style={{ color: ANSWER_COLORS[k] }}>{k}</span>
                                            <span className={clsx(
                                                'font-extrabold text-lg',
                                                isRevealed && isC ? 'text-green-600' :
                                                isRevealed && !isC ? 'text-slate-400' : 'text-slate-800'
                                            )}>
                                                {v}
                                            </span>
                                        </div>
                                        {totalVotes > 0 && (
                                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                                                <div
                                                    className={clsx('h-full rounded-full transition-all',
                                                        isRevealed && isC ? 'bg-green-500' : 'bg-blue-500'
                                                    )}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        )}
                                        {isRevealed && (
                                            <div className="text-center text-xs font-semibold mt-1.5 text-slate-500">
                                                {pct}%
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── BOTTOM CONTROLS ─────────────────────────────────────────── */}
            <div className="min-h-12 bg-white border-t border-slate-200 flex items-center justify-center flex-wrap gap-2 md:gap-3 px-3 md:px-8 py-2 shrink-0 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
                {phase === 'question' && (
                    <p className="text-sm text-slate-400 italic">Chọn thời gian rồi bấm <strong>Bắt đầu</strong></p>
                )}
                {phase === 'countdown' && (
                    <>
                        <button onClick={togglePause}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
                            {timerRunning ? <><Pause className="w-4 h-4" />Tạm dừng</> : <><Play className="w-4 h-4" />Tiếp tục</>}
                        </button>
                        <button onClick={skipToScan}
                            className="flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-full shadow-md hover:-translate-y-0.5 transition-all"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}>
                            Kết thúc giờ <ChevronRight className="w-4 h-4" />
                        </button>
                    </>
                )}
                {phase === 'scanning' && (
                    <>
                        <button onClick={clearResponses}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
                            <RefreshCw className="w-4 h-4" /> Xoá phiếu
                        </button>
                        <button onClick={() => setShowRevealConfirm(true)}
                            className="flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-full shadow-md hover:-translate-y-0.5 transition-all bg-green-600 hover:bg-green-500">
                            <Eye className="w-4 h-4" /> Hiện đáp án
                        </button>
                    </>
                )}
                {phase === 'revealed' && (
                    <>
                        <button onClick={() => { setPhase('scanning'); broadcastState({ phase: 'scanning' }); }}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
                            <EyeOff className="w-4 h-4" /> Ẩn đáp án
                        </button>
                        <button onClick={retryQuestion}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-full border-2 border-amber-400 text-amber-700 hover:bg-amber-50 transition-all">
                            <RefreshCw className="w-4 h-4" /> Thi lại câu
                        </button>
                        {(activeSet?.backupQuestions?.length > 0) && (
                            <button onClick={() => setShowBackupPicker(true)}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-full border-2 border-red-400 text-red-700 hover:bg-red-50 transition-all">
                                <X className="w-4 h-4" /> Loại bỏ câu
                            </button>
                        )}
                        {eliminatedConts.length > 0 && (
                            <button onClick={() => setShowRescue(true)}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-full border-2 border-green-400 text-green-700 hover:bg-green-50 transition-all">
                                <HeartHandshake className="w-4 h-4" /> Cứu trợ ({eliminatedConts.length})
                            </button>
                        )}
                        <button onClick={handleNext}
                            disabled={(session.questionIndex ?? 0) >= ((activeSet?.questions?.length || session.total_questions || 1) - 1)}
                            className="flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-full shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                            Câu tiếp <ChevronRight className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>

            {/* ── MODALS ───────────────────────────────────────────────────── */}
            {showConfirmEnd && (
                <ConfirmEndDialog onConfirm={handleEnd} onCancel={() => setShowConfirmEnd(false)} />
            )}
            {/* FIX #5: Reveal confirmation dialog */}
            {showRevealConfirm && (
                <ConfirmRevealDialog onConfirm={confirmReveal} onCancel={() => setShowRevealConfirm(false)} />
            )}
            {showRescue && (
                <RescueModal
                    eliminated={eliminatedConts}
                    onRescue={handleRescue}
                    onClose={() => setShowRescue(false)}
                    loading={rescueLoading}
                />
            )}
            {showBackupPicker && (
                <BackupQuestionPicker
                    backupQuestions={activeSet?.backupQuestions || []}
                    usedBackupIds={session?.used_backup_ids || []}
                    onSelect={handleUseBackup}
                    onClose={() => setShowBackupPicker(false)}
                    loading={loading}
                />
            )}
        </div>
    );
}