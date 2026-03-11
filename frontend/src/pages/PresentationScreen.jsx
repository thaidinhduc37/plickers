/**
 * pages/PresentationScreen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tối ưu cho máy chiếu lớp học — Giao diện Sáng (Light Theme).
 * Đã refactor toàn bộ sang Tailwind CSS cho gọn gàng.
 */

import React, { useEffect, useState, useRef } from 'react';
import { usePresentationChannel } from '../hooks/usePresentationChannel';
import clsx from 'clsx'; // Nếu project chưa có clsx, bạn có thể cài (npm i clsx) hoặc đổi sang template string `${}`

// ── Palette ───────────────────────────────────────────────────────────────────
const TILE = {
    A: { bg: '#EF4444', dark: '#B91C1C', glow: 'rgba(239,68,68,0.4)' },
    B: { bg: '#3B82F6', dark: '#1D4ED8', glow: 'rgba(59,130,246,0.4)' },
    C: { bg: '#F59E0B', dark: '#B45309', glow: 'rgba(245,158,11,0.4)' },
    D: { bg: '#10B981', dark: '#047857', glow: 'rgba(16,185,129,0.4)' },
};
const ANSWER_KEYS = ['A', 'B', 'C', 'D'];

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        const pieces = Array.from({ length: 180 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height,
            w: Math.random() * 14 + 6, h: Math.random() * 8 + 4,
            r: Math.random() * Math.PI * 2,
            vx: (Math.random() - 0.5) * 4, vy: Math.random() * 5 + 3,
            vr: (Math.random() - 0.5) * 0.2,
            color: ['#FFD700','#FF4444','#3B82F6','#10B981','#FF44CC','#06B6D4'][Math.floor(Math.random()*6)],
        }));
        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pieces.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.r += p.vr;
                if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
                ctx.restore();
            });
            raf = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(raf);
    }, []);
    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[999999]" />;
}

// ── Big Timer Ring ────────────────────────────────────────────────────────────
function BigTimerRing({ seconds, total }) {
    const SIZE   = 220;
    const r      = (SIZE - 20) / 2;
    const circ   = 2 * Math.PI * r;
    const pct    = total > 0 ? seconds / total : 0;
    const dash   = circ * pct;
    const urgent = seconds <= 5 && seconds > 0;
    const color  = seconds === 0 ? '#EF4444' : urgent ? '#F97316' : '#1e293b'; 
    const strokeColor = seconds === 0 ? '#EF4444' : urgent ? '#F97316' : '#3B82F6'; 
    return (
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} className="absolute -rotate-90">
                <circle cx={SIZE/2} cy={SIZE/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={14} />
                <circle cx={SIZE/2} cy={SIZE/2} r={r} fill="none"
                    stroke={strokeColor} strokeWidth={14}
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear" />
            </svg>
            <span 
                className={clsx("text-[88px] font-black font-['Bebas_Neue','Impact',sans-serif] transition-colors duration-300", 
                    urgent && "animate-[psScalePulse_0.5s_infinite]"
                )}
                style={{ color }}>
                {seconds}
            </span>
        </div>
    );
}

// ── Answer Tile ───────────────────────────────────────────────────────────────
function AnswerTile({ letter, text, revealed, isCorrect, votes, totalVotes, animDelay = 0 }) {
    const t       = TILE[letter];
    const pct     = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    const isFaded = revealed && !isCorrect;
    const isWin   = revealed && isCorrect;
    
    return (
        <div 
            className={clsx(
                "relative rounded-2xl overflow-hidden transition-all duration-500 min-h-[110px]",
                isFaded ? "bg-slate-100 border-2 border-slate-200 opacity-60 shadow-none" 
                        : (isWin ? "border-4 border-emerald-500 scale-103" : "border-2 border-transparent shadow-lg shadow-slate-200/50")
            )}
            style={{ 
                backgroundColor: isFaded ? undefined : t.bg,
                boxShadow: isWin ? `0 20px 50px ${t.glow}` : undefined,
                animation: `psSlideUp 0.5s cubic-bezier(0.175,0.885,0.32,1.275) ${animDelay}s both`
            }}>
            
            {revealed && !isFaded && (
                <div 
                    className="absolute inset-y-0 left-0 bg-white/20 transition-[width] duration-1000 ease-out delay-300"
                    style={{ width: `${pct}%` }} 
                />
            )}

            <div className="relative flex items-center gap-5 px-7 py-5">
                <div 
                    className={clsx(
                        "w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center text-[32px] font-black font-['Bebas_Neue','Impact',sans-serif]",
                        isFaded ? "bg-slate-200 text-slate-400 shadow-none" : "text-white shadow-md shadow-black/20"
                    )}
                    style={{ backgroundColor: isFaded ? undefined : t.dark }}>
                    {letter}
                </div>
                
                <span className={clsx(
                    "flex-1 text-[26px] font-extrabold leading-snug",
                    isFaded ? "text-slate-500 drop-shadow-none" : "text-white drop-shadow-md"
                )}>
                    {text || `Đáp án ${letter}`}
                </span>
                
                {revealed && (
                    <div className="text-right shrink-0 z-10">
                        <div className={clsx(
                            "text-[44px] font-black leading-none font-['Bebas_Neue','Impact',sans-serif]",
                            isFaded ? "text-slate-500" : "text-white"
                        )}>
                            {votes}
                        </div>
                        <div className={clsx("text-base font-bold", isFaded ? "text-slate-400" : "text-white/90")}>
                            {pct}%
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Advancing Contestants Grid ────────────────────────────────────────────────
function AdvancingGrid({ contestants, responses, correctAnswer }) {
    const advancing = (contestants ?? []).filter(c => {
        if (c.status === 'eliminated') return false;
        const r   = responses?.[c.card_id];
        const ans = typeof r === 'object' ? r?.answer : r;
        return ans === correctAnswer;
    });

    if (!advancing.length || !correctAnswer) return null;

    return (
        <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl p-7 animate-[psSlideUp_0.6s_ease_0.7s_both]">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="bg-emerald-500 rounded-lg px-4 py-1.5 text-[15px] font-extrabold text-white tracking-wide uppercase">
                    ✓ Trả lời đúng
                </div>
                <span className="text-slate-500 text-[15px] font-bold">
                    {advancing.length} người
                </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
                {advancing.map(c => (
                    <div key={c.id} className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 text-emerald-800 font-bold text-sm">
                        <div className="text-emerald-700/80 text-[11px] font-extrabold mb-0.5">
                            #{String(c.card_id).padStart(3,'0')}
                        </div>
                        <div className="leading-snug">{c.name}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Step Numbers ──────────────────────────────────────────────────────────────
function StepNumbers({ questions, currentIndex }) {
    if (!questions.length) return null;
    return (
        <div className="flex items-center gap-1.5 flex-wrap max-w-[450px] justify-end">
            {questions.map((_, idx) => {
                const isCur  = idx === currentIndex;
                const isDone = idx < currentIndex;
                return (
                    <div key={idx} className={clsx(
                        "w-7 h-7 rounded-md flex items-center justify-center text-[13px] font-extrabold transition-all",
                        isCur  ? "bg-blue-500 text-white border-transparent" : 
                        isDone ? "bg-blue-100 text-blue-700 border-transparent" : 
                                 "bg-slate-100 text-slate-400 border border-slate-200"
                    )}>
                        {idx + 1}
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PresentationScreen() {
    const { state } = usePresentationChannel('receiver');
    const [showConfetti, setShowConfetti] = useState(false);
    const [lastUpdate,   setLastUpdate]   = useState(Date.now());
    const prevPhase = useRef(null);

    // Track last state update time to show sync indicator
    useEffect(() => {
        if (state) setLastUpdate(Date.now());
    }, [state]);

    useEffect(() => {
        if (state?.phase === 'revealed' && prevPhase.current !== 'revealed') {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 6000);
        }
        prevPhase.current = state?.phase;
    }, [state?.phase]);

    const phase       = state?.phase       ?? 'idle';
    const question    = state?.question;
    const questions   = state?.questions   ?? [];
    const votes       = state?.votes       ?? {};
    const timeLeft    = state?.timeLeft    ?? 0;
    const timerTotal  = state?.timerTotal  ?? 15;
    const scanned     = state?.scannedCount ?? 0;
    const activeTotal = state?.activeTotal ?? 0;
    const eventName   = state?.eventName   ?? '';
    const qIndex      = state?.questionIndex ?? 0;
    const qTotal      = state?.totalQuestions ?? 0;
    const contestants = state?.contestants ?? [];
    const responses   = state?.responses   ?? {};
    const totalVotes  = ANSWER_KEYS.reduce((s, k) => s + (votes[k] || 0), 0);

    const STATUS = {        lobby:     { label: 'CHUẨN BỊ',           colors: 'text-blue-500 bg-blue-50 border-blue-500/40' },        question:  { label: 'ĐỌC CÂU HỎI',       colors: 'text-blue-500 bg-blue-50 border-blue-500/40' },
        countdown: { label: 'THỜI GIAN SUY NGHĨ', colors: 'text-amber-500 bg-amber-50 border-amber-500/40' },
        scanning:  { label: 'ĐANG THU TÍN HIỆU',  colors: 'text-violet-500 bg-violet-50 border-violet-500/40', pulse: true },
        revealed:  { label: 'CÔNG BỐ ĐÁP ÁN',     colors: 'text-emerald-500 bg-emerald-50 border-emerald-500/40' },
    };
    const st = STATUS[phase];

    const qTextSizeClass = question?.text?.length > 120 ? 'text-4xl' 
                         : question?.text?.length > 80  ? 'text-5xl' 
                         : question?.text?.length > 50  ? 'text-6xl' : 'text-7xl';

    return (
        <div className="fixed inset-0 z-[99999] w-screen h-screen overflow-hidden bg-slate-50 flex flex-col font-['Nunito','Segoe_UI',sans-serif]">
            
            {/* Giữ lại custom animations phức tạp */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800;900&display=swap');
                @keyframes psSlideUp     { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
                @keyframes psFadeIn      { from { opacity:0; } to { opacity:1; } }
                @keyframes psZoomIn      { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
                @keyframes psScalePulse  { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
                @keyframes psPulseGlow   { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
            `}</style>

            {showConfetti && <Confetti />}

            {/* ── TOP BAR: ẩn khi idle ── */}
            {phase !== 'idle' && phase !== 'lobby' && (
            <div className="shrink-0 flex items-center justify-between px-12 py-4 bg-white border-b border-slate-200 shadow-sm animate-[psFadeIn_0.5s_ease] gap-5">
                <div className="flex items-center gap-3 shrink-0">
                <div className="text-xl font-black text-slate-800 tracking-wide uppercase">
                    {eventName || 'QUIZPOLL'}
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-[psPulseGlow_2s_infinite] inline-block" />
                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">LIVE</span>
                </div>
                </div>{/* end left wrapper */}

                {phase !== 'idle' && st && (
                    <div className={clsx(
                        "px-6 py-1.5 rounded-full border text-sm font-extrabold tracking-wide uppercase shrink-0",
                        st.colors,
                        st.pulse && "animate-[psPulseGlow_1.2s_infinite]"
                    )}>
                        {st.label}
                    </div>
                )}

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {phase !== 'idle' && phase !== 'lobby' && (
                        <>
                            <div className="text-sm font-bold text-slate-500">
                                Câu <span className="text-blue-500 font-black text-lg">{qIndex + 1}</span> / {qTotal || questions.length}
                            </div>
                            <StepNumbers questions={questions} currentIndex={qIndex} />
                        </>
                    )}
                </div>
            </div>
            )}{/* end topbar conditional */}

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 relative flex flex-col items-center justify-center px-12 py-5 pb-6 gap-6 overflow-auto">
                
                {/* ── LOBBY: ảnh chờ bắt đắu ── */}
                {phase === 'lobby' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-end animate-[psFadeIn_0.8s_ease]">
                        {/* ảnh nền toàn màn */}
                        <img
                            src="/images/bat-dau.png"
                            alt="Sắp bắt đắu"
                            className="absolute inset-0 w-full h-full object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        {/* Overlay thông tin ở dưới */}
                        <div className="relative z-10 w-full flex items-center justify-center gap-8 pb-10 animate-[psSlideUp_0.6s_ease_0.4s_both]">
                            <div className="px-8 py-4 bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl text-center shadow-xl">
                                <div className="text-[48px] font-black text-blue-600 leading-none">{activeTotal}</div>
                                <div className="text-sm font-bold text-blue-400 uppercase tracking-widest mt-1">Thí sinh</div>
                            </div>
                            {qTotal > 0 && (
                                <div className="px-8 py-4 bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl text-center shadow-xl">
                                    <div className="text-[48px] font-black text-slate-700 leading-none">{qTotal}</div>
                                    <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Câu hỏi</div>
                                </div>
                            )}
                            <div className="px-8 py-4 bg-white/90 backdrop-blur-sm border border-white/60 rounded-2xl text-center shadow-xl animate-[psPulseGlow_1.5s_infinite]">
                                <div className="text-lg font-black text-slate-600 uppercase tracking-wide">
                                    Vui lòng chờ...
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── IDLE: ảnh toàn màn hình khi chưa bắt đắu / kết thúc ── */}
                {phase === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center animate-[psFadeIn_0.8s_ease]">
                        <img
                            src="/images/rung-chuong-vang.png"
                            alt="Rung Chuông Vàng"
                            className="w-full h-full object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                )}

                {phase !== 'idle' && phase !== 'lobby' && (
                    <>
                        <div className="w-full max-w-[1320px] text-center animate-[psFadeIn_0.6s_ease] shrink-0">
                            <div className="inline-block px-5 py-1 rounded-full bg-slate-100 border border-slate-200 text-sm font-extrabold text-slate-500 mb-4 tracking-wide">
                                CÂU HỎI {qIndex + 1}
                            </div>
                            <h2 className={clsx("font-black text-slate-900 leading-snug m-0", qTextSizeClass)}>
                                {question?.text || 'Đang đồng bộ dữ liệu...'}
                            </h2>
                        </div>

                        {phase === 'question' && (
                            <div className="grid grid-cols-2 gap-5 w-full max-w-[1320px] animate-[psSlideUp_0.5s_ease]">
                                {ANSWER_KEYS.map((k, i) => (
                                    <AnswerTile key={k} letter={k}
                                        text={question?.[`option_${k.toLowerCase()}`]}
                                        revealed={false} animDelay={i * 0.07} />
                                ))}
                            </div>
                        )}

                        {phase === 'countdown' && (
                            <div className="flex items-center gap-14 w-full max-w-[1380px] animate-[psZoomIn_0.4s_ease]">
                                <BigTimerRing seconds={timeLeft} total={timerTotal} />
                                <div className="flex-1 grid grid-cols-2 gap-5">
                                    {ANSWER_KEYS.map((k, i) => (
                                        <AnswerTile key={k} letter={k}
                                            text={question?.[`option_${k.toLowerCase()}`]}
                                            revealed={false} animDelay={i * 0.07} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {phase === 'scanning' && (
                            <div className="w-full flex-1 flex flex-col items-center gap-5 min-h-0 animate-[psZoomIn_0.4s_ease]">
                                <div className="inline-flex items-center gap-3 bg-white px-8 py-3 rounded-full shadow-sm border border-slate-200">
                                    <div className="w-3.5 h-3.5 rounded-full bg-violet-500 animate-[psPulseGlow_1.2s_infinite]" />
                                    <span className="text-lg font-extrabold text-slate-500 uppercase tracking-wide">
                                        Mời giơ thẻ để Camera ghi nhận
                                    </span>
                                </div>
                                
                                <div className="w-full max-w-[1400px] flex-1 bg-white rounded-3xl border border-slate-200 p-6 overflow-y-auto grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 content-start shadow-inner">
                                    {contestants.map(c => {
                                        const r = responses?.[c.card_id];
                                        const hasVoted = !!r; 
                                        return (
                                            <div key={c.id} className={clsx(
                                                "aspect-[4/3] rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ease-out",
                                                hasVoted ? "bg-emerald-500 text-white border-2 border-emerald-600 shadow-lg shadow-emerald-500/30 scale-105" 
                                                         : "bg-slate-50 text-slate-400 border-2 border-slate-200"
                                            )}>
                                                <div className="text-[26px] font-black leading-none">
                                                    #{String(c.card_id).padStart(2,'0')}
                                                </div>
                                                <div className={clsx(
                                                    "text-[13px] font-bold mt-1 max-w-[90%] truncate",
                                                    hasVoted ? "opacity-90" : "opacity-60"
                                                )}>
                                                    {c.name.split(' ').pop()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {phase === 'revealed' && (
                            <div className="w-full max-w-[1380px] flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-5">
                                    {ANSWER_KEYS.map((k, i) => (
                                        <AnswerTile key={k} letter={k}
                                            text={question?.[`option_${k.toLowerCase()}`]}
                                            revealed={true}
                                            isCorrect={k === question?.correct_answer}
                                            votes={votes[k] || 0}
                                            totalVotes={totalVotes}
                                            animDelay={i * 0.07} />
                                    ))}
                                </div>
                                <AdvancingGrid
                                    contestants={contestants}
                                    responses={responses}
                                    correctAnswer={question?.correct_answer}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── BOTTOM BAR ── */}
            {phase !== 'idle' && phase !== 'lobby' && phase !== 'question' && activeTotal > 0 && (
                <div className="shrink-0 px-12 pb-5 animate-[psFadeIn_0.5s_ease]">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] font-extrabold text-slate-500 tracking-wide uppercase">
                            Đã quét
                        </span>
                        <span className="text-[14px] font-black text-slate-800">
                            <span className={clsx("text-[18px]", scanned === activeTotal ? "text-emerald-500" : "text-blue-500")}>
                                {scanned}
                            </span> / {activeTotal}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div 
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-400 ease-out"
                            style={{ width: `${activeTotal > 0 ? (scanned / activeTotal) * 100 : 0}%` }} 
                        />
                    </div>
                </div>
            )}
        </div>
    );
}