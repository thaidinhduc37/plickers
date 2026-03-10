/**
 * src/pages/LiveView.jsx
 * FIXED #4 — Thêm tính năng Cứu trợ (Rescue) với 3 chế độ:
 *   - Random N người từ danh sách bị loại
 *   - Nhập số báo danh thủ công
 *   - Lọt sâu nhất (sort theo correct_count)
 *
 * Nút Cứu trợ chỉ hiển thị ở phase 'revealed' (sau khi đã công bố đáp án)
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale,
    BarElement, Tooltip, Legend
} from 'chart.js';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useAudio } from '../hooks/useAudio';
import {
    Square, Eye, EyeOff, RefreshCw, Camera, CameraOff,
    ChevronRight, Radio, Zap, Users, CheckCircle2,
    Timer, Play, Pause, AlertTriangle, HeartHandshake,
    Shuffle, List, TrendingUp, X, UserCheck
} from 'lucide-react';
import clsx from 'clsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const ANSWER_COLORS = { A: '#E53E3E', B: '#3182CE', C: '#D69E2E', D: '#38A169' };
const ANSWER_KEYS = ['A', 'B', 'C', 'D'];
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

// ─── FIX #4: Rescue Modal ─────────────────────────────────────────────────────
function RescueModal({ eliminated, onRescue, onClose, loading }) {
    const [mode, setMode] = useState('random'); // 'random' | 'manual' | 'deepest'
    const [count, setCount] = useState(1);
    const [manualInput, setManualInput] = useState(''); // card_id hoặc tên, cách nhau bởi dấu phẩy/xuống dòng
    const [preview, setPreview] = useState(null); // danh sách sẽ được cứu (preview)
    const [step, setStep] = useState(1); // 1: chọn chế độ, 2: xác nhận

    // Tính preview danh sách sẽ được cứu
    const computePreview = useCallback(() => {
        if (mode === 'manual') {
            // Parse input: card_id hoặc số thứ tự
            const tokens = manualInput
                .split(/[\n,，;]+/)
                .map(s => s.trim())
                .filter(Boolean);
            const cardIds = tokens.map(t => parseInt(t, 10)).filter(n => !isNaN(n));
            return eliminated.filter(c => cardIds.includes(c.card_id)).slice(0, 50);
        } else if (mode === 'deepest') {
            return [...eliminated]
                .sort((a, b) => (b.correct_count ?? 0) - (a.correct_count ?? 0))
                .slice(0, count);
        } else {
            // random — chỉ preview thứ tự ngẫu nhiên hiện tại
            return [...eliminated]
                .sort(() => Math.random() - 0.5)
                .slice(0, count);
        }
    }, [mode, count, manualInput, eliminated]);

    const handlePreview = () => {
        const p = computePreview();
        setPreview(p);
        setStep(2);
    };

    const handleConfirm = () => {
        if (!preview || preview.length === 0) return;
        const ids = preview.map(c => c.id);
        onRescue('manual', ids.length, ids);
    };

    const modeConfigs = [
        {
            key: 'random',
            icon: Shuffle,
            label: 'Random',
            desc: 'Bốc thăm ngẫu nhiên từ danh sách bị loại',
            color: '#8B5CF6',
        },
        {
            key: 'deepest',
            icon: TrendingUp,
            label: 'Lọt sâu nhất',
            desc: 'Người trả lời đúng nhiều câu nhất',
            color: '#F59E0B',
        },
        {
            key: 'manual',
            icon: List,
            label: 'Thủ công',
            desc: 'Nhập số báo danh (thẻ) cụ thể',
            color: '#10B981',
        },
    ];

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                    style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
                            <HeartHandshake className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-green-900">Cứu trợ thí sinh</h2>
                            <p className="text-xs text-green-700">
                                {eliminated.length} người đang bị loại
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-green-100 text-green-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {step === 1 && (
                    <div className="p-5 space-y-4">
                        {/* Mode selection */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chế độ cứu trợ</p>
                            {modeConfigs.map(cfg => (
                                <button
                                    key={cfg.key}
                                    onClick={() => setMode(cfg.key)}
                                    className={clsx(
                                        'flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all',
                                        mode === cfg.key
                                            ? 'border-current shadow-sm'
                                            : 'border-slate-200 hover:border-slate-300'
                                    )}
                                    style={mode === cfg.key ? { borderColor: cfg.color, background: cfg.color + '10' } : {}}
                                >
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: cfg.color + '20' }}>
                                        <cfg.icon className="w-4.5 h-4.5" style={{ color: cfg.color }} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800">{cfg.label}</p>
                                        <p className="text-xs text-slate-500">{cfg.desc}</p>
                                    </div>
                                    {mode === cfg.key && (
                                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: cfg.color }}>
                                            <div className="w-2 h-2 rounded-full bg-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Count selector — cho random và deepest */}
                        {mode !== 'manual' && (
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Số người cứu trợ
                                </p>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCount(c => Math.max(1, c - 1))}
                                        className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold text-lg"
                                    >−</button>
                                    <div className="flex-1 text-center">
                                        <span className="text-3xl font-extrabold text-slate-800">{count}</span>
                                        <span className="text-slate-400 text-sm ml-1">/ {eliminated.length} người</span>
                                    </div>
                                    <button
                                        onClick={() => setCount(c => Math.min(eliminated.length, c + 1))}
                                        className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold text-lg"
                                    >+</button>
                                </div>
                                {/* Quick presets */}
                                <div className="flex gap-2 mt-2 justify-center">
                                    {[1, 3, 5, 10].filter(n => n <= eliminated.length).map(n => (
                                        <button key={n} onClick={() => setCount(n)}
                                            className={clsx(
                                                'px-3 py-1 rounded-lg text-xs font-bold border transition-all',
                                                count === n ? 'bg-green-600 text-white border-green-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                            )}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Manual input */}
                        {mode === 'manual' && (
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Nhập số báo danh (thẻ)
                                </p>
                                <textarea
                                    className="w-full h-28 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                                    placeholder={"Mỗi số 1 dòng hoặc cách nhau bởi dấu phẩy\nVí dụ:\n5\n12\n23"}
                                    value={manualInput}
                                    onChange={e => setManualInput(e.target.value)}
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                    {eliminated.slice(0, 30).map(c => (
                                        <button key={c.id}
                                            onClick={() => {
                                                const id = String(c.card_id);
                                                setManualInput(prev => {
                                                    const lines = prev.split('\n').map(s => s.trim()).filter(Boolean);
                                                    return lines.includes(id)
                                                        ? lines.filter(l => l !== id).join('\n')
                                                        : [...lines, id].join('\n');
                                                });
                                            }}
                                            className={clsx(
                                                'text-xs px-2 py-0.5 rounded border font-mono transition-all',
                                                manualInput.split(/[\n,]+/).map(s => s.trim()).includes(String(c.card_id))
                                                    ? 'bg-green-600 text-white border-green-600'
                                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                            )}>
                                            #{String(c.card_id).padStart(2, '0')} {c.name.split(' ').slice(-1)[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action */}
                        <div className="flex gap-3 pt-1">
                            <button onClick={onClose}
                                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                                Huỷ
                            </button>
                            <button
                                onClick={handlePreview}
                                disabled={mode === 'manual' && !manualInput.trim()}
                                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                                Xem trước →
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && preview && (
                    <div className="p-5 space-y-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                Xác nhận cứu trợ {preview.length} thí sinh
                            </p>
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                                {preview.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-3">Không tìm thấy thí sinh phù hợp</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {preview.map(c => (
                                            <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-green-100">
                                                <UserCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        Thẻ #{String(c.card_id).padStart(2, '0')}
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
                            <button onClick={() => { setStep(1); setPreview(null); }}
                                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                                ← Quay lại
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading || preview.length === 0}
                                className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                                {loading
                                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang cứu...</>
                                    : <><HeartHandshake className="w-4 h-4" /> Xác nhận cứu trợ</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Timer ring ───────────────────────────────────────────────────────────────
function TimerRing({ seconds, total, size = 140 }) {
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;
    const pct = total > 0 ? seconds / total : 0;
    const dash = circ * pct;
    const urgent = seconds <= 5 && seconds > 0;
    const color = seconds === 0 ? '#ef4444' : urgent ? '#f97316' : '#10509F';
    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none"
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
function NoSession({ events, onStart }) {
    return (
        <div className="flex flex-col h-full items-center justify-center bg-slate-50 p-8">
            <div className="w-full max-w-xl">
                <div className="text-center mb-8">
                    <div className="inline-flex w-20 h-20 rounded-2xl items-center justify-center mb-5 shadow-lg"
                        style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                        <Radio className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Bắt đầu phiên thi</h2>
                    <p className="text-slate-500 text-sm">Chọn một cuộc thi để bắt đầu màn hình chiếu trực tiếp.</p>
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
                            const total = ev.contestants.length;
                            return (
                                <button key={ev.id} onClick={() => onStart(ev.id)}
                                    className="flex items-center gap-4 w-full px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-left hover:border-blue-400 hover:shadow-lg transition-all group">
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
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0"
                                        style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                                        <Zap className="w-3.5 h-3.5" /> Bắt đầu
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main LiveView ────────────────────────────────────────────────────────────
export default function LiveView() {
    const {
        questionSets, events, session, contestants,
        startSession, endSession, nextQuestion, revealAnswer, clearResponses, simulateAnswer,
        cameraConnected, fetchActiveSession, fetchContestants,
        rescueContestants, // FIX #4
    } = useApp();
    const navigate = useNavigate();

    const [phase, setPhase] = useState('question');
    const [timerSel, setTimerSel] = useState(15);
    const [timeLeft, setTimeLeft] = useState(15);
    const [timerRunning, setTimerRunning] = useState(false);
    const [showConfirmEnd, setShowConfirmEnd] = useState(false);
    const [showRescue, setShowRescue] = useState(false); // FIX #4
    const [rescueLoading, setRescueLoading] = useState(false); // FIX #4
    const [questionHistory, setQuestionHistory] = useState({}); // idx → { votes, correct_answer }
    const intervalRef = useRef(null);
    const prevQIdx = useRef(null);
    const { play: playAudio, stop: stopAudio, beep } = useAudio();

    useEffect(() => {
        fetchActiveSession?.();
        fetchContestants?.();
    }, []);

    useEffect(() => {
        if (session?.questionIndex !== undefined && session.questionIndex !== prevQIdx.current) {
            prevQIdx.current = session.questionIndex;
            setPhase('question');
            setTimerRunning(false);
            setTimeLeft(timerSel);
            clearInterval(intervalRef.current);
        }
    }, [session?.questionIndex]);

    useEffect(() => {
        clearInterval(intervalRef.current);
        if (!timerRunning) return;
        intervalRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(intervalRef.current);
                    setTimerRunning(false);
                    setPhase('scanning');
                    stopAudio();
                    beep(600, 400); // beep khi hết giờ
                    return 0;
                }
                if (t <= 4) beep(880, 120); // beep đếm ngược 3-2-1
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [timerRunning]);

    const startTimer = () => {
        setTimeLeft(timerSel);
        setTimerRunning(true);
        setPhase('countdown');
        playAudio(`/sounds/${timerSel}s.mp3`, { volume: 0.7 })
            .catch(() => {}); // fallback đến beep nếu file không có
    };
    const togglePause = () => {
        setTimerRunning(r => {
            if (r) stopAudio(); // đang chạy → pause → stop audio
            return !r;
        });
    };
    const skipToScan = () => {
        clearInterval(intervalRef.current);
        setTimerRunning(false);
        setTimeLeft(0);
        setPhase('scanning');
        stopAudio();
    };
    const handleReveal = async () => { await revealAnswer(); setPhase('revealed'); };
    const handleNext = async () => {
        // Save current question's votes to history before advancing
        const curIdx = session?.questionIndex ?? 0;
        setQuestionHistory(prev => ({
            ...prev,
            [curIdx]: { votes: session?.votes ?? {}, correct_answer: currentQ?.correct_answer },
        }));
        await nextQuestion();
        clearResponses();
        setPhase('question');
        setTimeLeft(timerSel);
    };
    const handleEnd = async () => { await endSession(); navigate('/dashboard'); };

    // FIX #4: Xử lý cứu trợ
    const handleRescue = async (mode, count, ids) => {
        setRescueLoading(true);
        try {
            await rescueContestants(mode, count, ids);
            setShowRescue(false);
        } finally {
            setRescueLoading(false);
        }
    };

    // Derived
    const activeEvent = events.find(e => e.id === session?.eventId);
    const activeSet = questionSets.find(s => s.id === activeEvent?.setId);
    const currentQ = activeSet?.questions[session?.questionIndex ?? 0];
    const activeConts = activeEvent?.contestants.filter(c => c.status === 'active') ?? [];
    const eliminatedConts = activeEvent?.contestants.filter(c => c.status === 'eliminated') ?? [];
    const respondedCount = Object.keys(session?.responses || {}).length;
    const totalVotes = ANSWER_KEYS.reduce((s, k) => s + (session?.votes?.[k] || 0), 0);
    const isRevealed = phase === 'revealed';

    if (!session) return <NoSession events={events} onStart={startSession} />;

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
        const raw = session?.responses?.[c.card_id];
        const hasVoted = typeof raw === 'object' ? raw?.answer : raw;
        if (c.status === 'eliminated') return { bg: '#e2e8f0', color: '#94a3b8', ring: 'transparent' };
        if (c.status === 'winner') return { bg: '#EAB308', color: '#fff', ring: '#ca8a04' };
        if (hasVoted) {
            if (phase === 'countdown' || phase === 'scanning') return { bg: ANSWER_COLORS[hasVoted], color: '#fff', ring: ANSWER_COLORS[hasVoted] };
            if (isRevealed) {
                const ok = hasVoted === currentQ?.correct_answer;
                return { bg: ok ? '#22c55e' : '#ef4444', color: '#fff', ring: ok ? '#16a34a' : '#dc2626' };
            }
        }
        return { bg: '#f1f5f9', color: '#94a3b8', ring: 'transparent' };
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">

            {/* ── TOP BAR ── */}
            <header className="bg-white border-b border-slate-200 px-6 flex items-center gap-4 shrink-0 shadow-sm" style={{ minHeight: 68 }}>
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 shrink-0">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">ID PHÒNG:</span>
                    <span className="text-sm font-bold text-indigo-700 font-mono tracking-wider">{session.id}</span>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-bold shrink-0">
                    <span style={{ color: '#10509F' }}>{(session.questionIndex ?? 0) + 1}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-600">{activeSet?.questions.length ?? session.total_questions ?? '?'}</span>
                </div>

                <p className="flex-1 text-base font-bold text-slate-900 line-clamp-2 min-w-0 border-l border-slate-200 pl-4">
                    {currentQ?.text || <span className="text-slate-400 italic">Đang tải...</span>}
                </p>

                <div className={clsx('px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border', {
                    'bg-blue-50   text-blue-700   border-blue-200': phase === 'question',
                    'bg-orange-50 text-orange-700 border-orange-200': phase === 'countdown',
                    'bg-purple-50 text-purple-700 border-purple-200': phase === 'scanning',
                    'bg-green-50  text-green-700  border-green-200': phase === 'revealed',
                })}>
                    {phase === 'question' && '📋 Đọc câu hỏi'}
                    {phase === 'countdown' && '⏱ Đang đếm giờ'}
                    {phase === 'scanning' && '📡 Đang quét thẻ'}
                    {phase === 'revealed' && '✅ Đã công bố'}
                </div>

                <div className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0',
                    cameraConnected ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400')}>
                    {cameraConnected ? <><Camera className="w-3.5 h-3.5" />Online</> : <><CameraOff className="w-3.5 h-3.5" />Chưa kết nối</>}
                </div>

                <button onClick={simulateAnswer}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                    + Giả lập
                </button>
                <button onClick={() => setShowConfirmEnd(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 rounded-lg border border-transparent transition-all shrink-0">
                    <Square className="w-4 h-4 fill-current" /> Kết thúc
                </button>
            </header>

            {/* ── ANSWER OPTIONS BAR ── */}
            <div className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-2 shrink-0 flex-wrap">
                {ANSWER_KEYS.map(k => {
                    const fk = `option_${k.toLowerCase()}`;
                    const isC = k === currentQ?.correct_answer;
                    const v = session?.votes?.[k] || 0;
                    const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                    return (
                        <div key={k} className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all',
                            isRevealed && isC ? 'bg-green-50 border-green-300 text-green-800 ring-2 ring-green-200'
                                : isRevealed && !isC ? 'opacity-40 border-slate-200 text-slate-400'
                                    : 'border-slate-200 text-slate-700'
                        )}>
                            <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-black text-white shrink-0"
                                style={{ backgroundColor: ANSWER_COLORS[k] }}>{k}</span>
                            <span className="max-w-[180px] truncate">{currentQ?.[fk] || `Đáp án ${k}`}</span>
                            {isRevealed && <span className={clsx('text-xs font-bold ml-1', isC ? 'text-green-700' : 'text-slate-400')}>{v} ({pct}%)</span>}
                        </div>
                    );
                })}
                <div className="ml-auto flex items-center gap-2 text-sm font-bold text-slate-500 shrink-0">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-xl font-extrabold" style={{ color: '#10509F' }}>{respondedCount}</span>
                    <span className="text-slate-400">/ {activeConts.length}</span>
                </div>
            </div>

            {/* ── MAIN SPLIT ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── QUESTION LIST SIDEBAR ── */}
                <div className="w-14 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
                    <div className="py-2.5 flex items-center justify-center border-b border-slate-200">
                        <List className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-1.5 items-center">
                        {(activeSet?.questions ?? []).map((q, idx) => {
                            const isCurrent = idx === (session?.questionIndex ?? 0);
                            const isDone = idx < (session?.questionIndex ?? 0);
                            const qHist = isDone ? (questionHistory[idx] ?? null) : null;
                            const correct = q.correct_answer;
                            return (
                                <div key={q.id ?? idx}
                                    className={clsx('w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold border-2 transition-all',
                                        isCurrent ? 'bg-blue-600 border-blue-600 text-white shadow-md' :
                                        isDone ? 'bg-green-500 border-green-500 text-white' :
                                        'bg-white border-slate-200 text-slate-400'
                                    )}
                                    title={`Câu ${idx + 1}${isDone && correct ? ` — Đúng: ${correct}` : ''}`}>
                                    {idx + 1}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── CONTENT ── */}
                <div className={`${(phase === 'question' || phase === 'countdown') ? 'flex-1' : 'flex-[2] border-r border-slate-200'} bg-white overflow-y-auto flex flex-col`}>

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
                            {/* Timer pills + start */}
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

                    {phase === 'countdown' && (
                        <div className="flex-1 flex flex-col items-center justify-center px-12 py-8 gap-7 max-w-5xl mx-auto w-full relative">
                            {/* Countdown ring — góc trên phải */}
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
                            <div className="grid grid-cols-10 gap-2 flex-1 content-start">
                                {activeEvent?.contestants.map(c => {
                                    const s = getTileStyle(c);
                                    const votedRaw = session?.responses?.[c.card_id];
                                    const voted = typeof votedRaw === 'object' ? votedRaw?.answer : votedRaw;
                                    return (
                                        <div key={c.id}
                                            className="aspect-[3/4] rounded-xl flex flex-col items-center justify-center gap-0.5 p-1 transition-all duration-300 hover:scale-105 shadow-sm"
                                            style={{ backgroundColor: s.bg, color: s.color, outline: `2px solid ${s.ring}`, outlineOffset: 1 }}
                                            title={`${c.name} (#${c.card_id})${voted ? ` → ${voted}` : ' — chưa quét'}`}>
                                            <span className="text-[11px] font-extrabold leading-none">#{String(c.card_id).padStart(2, '0')}</span>
                                            <span className="text-[7px] font-medium leading-none opacity-80 truncate w-full text-center px-0.5">{c.name.split(' ').slice(-1)[0]}</span>
                                            {voted && <span className="text-[9px] font-black leading-none">{voted}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
                                {/* FIX #4: Nút cứu trợ — hiện khi có người bị loại */}
                                {eliminatedConts.length > 0 && (
                                    <button
                                        onClick={() => setShowRescue(true)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 transition-all shadow-sm shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                                        <HeartHandshake className="w-4 h-4" />
                                        Cứu trợ
                                        <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                                            {eliminatedConts.length}
                                        </span>
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-10 gap-2 content-start flex-1">
                                {activeEvent?.contestants.map(c => {
                                    const s = getTileStyle(c);
                                    return (
                                        <div key={c.id}
                                            className="aspect-[3/4] rounded-xl flex flex-col items-center justify-center gap-0.5 p-1 shadow-sm"
                                            style={{ backgroundColor: s.bg, color: s.color, outline: `2px solid ${s.ring}`, outlineOffset: 1 }}
                                            title={(() => { const r = session?.responses?.[c.card_id]; const a = typeof r === 'object' ? r?.answer : r; return `${c.name}: ${a || 'không trả lời'}`; })()}>
                                            <span className="text-[11px] font-extrabold leading-none">#{String(c.card_id).padStart(2, '0')}</span>
                                            <span className="text-[7px] font-medium leading-none opacity-80 truncate w-full text-center px-0.5">{c.name.split(' ').slice(-1)[0]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Chart (scanning/revealed only) ── */}
                {(phase === 'scanning' || phase === 'revealed') && (
                <div className="flex-[1] bg-white flex flex-col overflow-hidden border-l border-slate-200">
                        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
                            {isRevealed && currentQ && (
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-800 rounded-lg font-bold text-xs border border-green-200">
                                    <CheckCircle2 className="w-3 h-3" /> Đúng: <span className="text-sm font-black">{currentQ.correct_answer}</span>
                                </div>
                            )}
                            <div className="absolute top-3 left-3 text-xs font-semibold bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-slate-500">
                                <span className="text-green-600 font-extrabold">{activeConts.length}</span> đang thi
                                {eliminatedConts.length > 0 && (
                                    <span className="ml-1.5 text-red-400">· {eliminatedConts.length} loại</span>
                                )}
                            </div>
                            <div className="w-full" style={{ height: 220, marginTop: 44 }}>
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                            <div className="flex justify-around w-full mt-3 px-2">
                                {ANSWER_KEYS.map(k => {
                                    const v = session?.votes?.[k] || 0;
                                    const pct = totalVotes > 0 ? Math.round((v / totalVotes) * 100) : 0;
                                    const isC = k === currentQ?.correct_answer;
                                    return (
                                        <div key={k} className="text-center">
                                            <div className={clsx('text-xl font-extrabold transition-all',
                                                isRevealed && isC ? 'text-green-600' :
                                                    isRevealed && !isC ? 'text-slate-300' : 'text-slate-800')}>
                                                {v}
                                            </div>
                                            <div className="text-xs font-bold" style={{ color: ANSWER_COLORS[k] }}>{k}</div>
                                            {isRevealed && <div className="text-[10px] text-slate-400">{pct}%</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                </div>
                )}
            </div>

            {/* ── BOTTOM CONTROLS ── */}
            <div className="h-16 bg-white border-t border-slate-200 flex items-center justify-center gap-3 px-8 shrink-0 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
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
                        <button onClick={handleReveal}
                            className="flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-full shadow-md hover:-translate-y-0.5 transition-all bg-green-600 hover:bg-green-500">
                            <Eye className="w-4 h-4" /> Hiện đáp án
                        </button>
                    </>
                )}
                {phase === 'revealed' && (
                    <>
                        <button onClick={() => setPhase('scanning')}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200">
                            <EyeOff className="w-4 h-4" /> Ẩn đáp án
                        </button>
                        {/* FIX #4: Nút cứu trợ ở bottom bar (backup) */}
                        {eliminatedConts.length > 0 && (
                            <button onClick={() => setShowRescue(true)}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-full border-2 border-green-400 text-green-700 hover:bg-green-50 transition-all">
                                <HeartHandshake className="w-4 h-4" /> Cứu trợ ({eliminatedConts.length})
                            </button>
                        )}
                        <button onClick={handleNext}
                            disabled={!activeSet || (session.questionIndex ?? 0) >= (activeSet.questions.length - 1)}
                            className="flex items-center gap-2 px-7 py-2.5 text-white font-bold rounded-full shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ background: 'linear-gradient(135deg,#10509F,#1a6fd4)' }}>
                            Câu tiếp <ChevronRight className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>

            {showConfirmEnd && (
                <ConfirmEndDialog onConfirm={handleEnd} onCancel={() => setShowConfirmEnd(false)} />
            )}

            {/* FIX #4: Rescue Modal */}
            {showRescue && (
                <RescueModal
                    eliminated={eliminatedConts}
                    onRescue={handleRescue}
                    onClose={() => setShowRescue(false)}
                    loading={rescueLoading}
                />
            )}
        </div>
    );
}