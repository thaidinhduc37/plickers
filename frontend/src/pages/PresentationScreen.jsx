/**
 * pages/PresentationScreen.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Giao diện Light Theme — Responsive 100% cho mọi loại màn (mobile → 4K projector).
 * Dùng CSS clamp() + vw/vh để scale mượt, không phụ thuộc breakpoint cứng.
 */

import React, { useEffect, useState, useRef } from 'react';
import { usePresentationChannel } from '../hooks/usePresentationChannel';
import ContestantGrid from '../components/ContestantGrid';
import clsx from 'clsx';

// ── Palette ───────────────────────────────────────────────────────────────────
const TILE = {
    A: { bg: '#FEF2F2', border: '#DC2626', text: '#B91C1C', glow: 'rgba(220,38,38,.35)' },
    B: { bg: '#EFF6FF', border: '#2563EB', text: '#1D4ED8', glow: 'rgba(37,99,235,.35)' },
    C: { bg: '#FFFBEB', border: '#D97706', text: '#B45309', glow: 'rgba(217,119,6,.35)' },
    D: { bg: '#ECFDF5', border: '#059669', text: '#047857', glow: 'rgba(5,150,105,.35)' },
};
const ANSWER_KEYS = ['A', 'B', 'C', 'D'];

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resize);
        resize();
        const pieces = Array.from({ length: 150 }, () => ({
            x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
            w: Math.random() * 10 + 6, h: Math.random() * 10 + 6,
            r: Math.random() * Math.PI * 2,
            vx: (Math.random() - 0.5) * 4, vy: Math.random() * 5 + 3,
            vr: (Math.random() - 0.5) * 0.2,
            color: ['#DC2626','#D97706','#2563EB','#059669','#7C3AED','#F59E0B'][Math.floor(Math.random()*6)],
        }));
        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of pieces) {
                p.x += p.vx; p.y += p.vy; p.r += p.vr;
                if (p.y > canvas.height) { p.y = -20; p.x = Math.random() * canvas.width; }
                ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
                ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
                ctx.restore();
            }
            raf = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[999999]" />;
}

// ── Timer Ring (vw-based — co giãn theo viewport) ─────────────────────────────
function BigTimerRing({ seconds, total }) {
    const pct    = total > 0 ? seconds / total : 0;
    const urgent = seconds <= 5 && seconds > 0;
    const color  = seconds === 0 ? '#DC2626' : urgent ? '#EA580C' : '#1E40AF';
    const stroke = seconds === 0 ? '#DC2626' : urgent ? '#EA580C' : '#2563EB';
    return (
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 'clamp(100px, 14vw, 260px)', height: 'clamp(100px, 14vw, 260px)' }}>
            <svg viewBox="0 0 100 100" className="absolute -rotate-90 w-full h-full drop-shadow-md">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#E2E8F0" strokeWidth="7" />
                <circle cx="50" cy="50" r="44" fill="none"
                    stroke={stroke} strokeWidth="7"
                    strokeDasharray={`${pct * 276.5} 276.5`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear" />
            </svg>
            <span className={clsx("font-black transition-colors duration-300", urgent && "animate-[psScalePulse_.5s_infinite]")}
                style={{ fontSize: 'clamp(2.5rem, 5.5vw, 7rem)', color, fontFamily: "Bebas Neue, Impact, sans-serif" }}>
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
        <div className={clsx(
                "relative rounded-2xl overflow-hidden transition-all duration-500 flex items-center",
                isFaded ? "bg-slate-100 border-2 border-slate-200 opacity-40 grayscale-[30%]"
                        : isWin  ? "border-[3px] scale-[1.02] z-10 shadow-xl bg-white"
                                 : "border-2 bg-white shadow-md"
            )}
            style={{
                borderColor: isFaded ? undefined : (isWin ? '#059669' : t.border),
                boxShadow:   isWin ? `0 8px 30px ${t.glow}` : undefined,
                animation:   `psSlideUp .45s cubic-bezier(.175,.885,.32,1.275) ${animDelay}s both`,
                minHeight:   'clamp(60px, 7vh, 130px)',
            }}>
            {/* vote bar */}
            {revealed && !isFaded && (
                <div className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-out delay-300"
                    style={{ width: `${pct}%`, backgroundColor: t.bg }} />
            )}
            <div className="relative flex items-center gap-[clamp(.5rem,1.2vw,1.5rem)] w-full h-full"
                style={{ padding: 'clamp(.5rem,1vw,1.5rem) clamp(.75rem,1.5vw,2rem)' }}>
                {/* badge */}
                <div className={clsx("rounded-xl shrink-0 flex items-center justify-center font-black text-white",
                        isFaded && "!bg-slate-300 !text-slate-500")}
                    style={{
                        width:  'clamp(2rem,3.5vw,4.5rem)',
                        height: 'clamp(2rem,3.5vw,4.5rem)',
                        fontSize: 'clamp(1.1rem,2vw,2.5rem)',
                        backgroundColor: isFaded ? undefined : t.border,
                        fontFamily: "Bebas Neue, Impact, sans-serif",
                    }}>
                    {letter}
                </div>
                {/* text */}
                <span className={clsx("flex-1 font-bold leading-snug line-clamp-3 break-words",
                        isFaded ? "text-slate-400" : "text-slate-800")}
                    style={{ fontSize: 'clamp(.85rem, 1.6vw, 2rem)' }}>
                    {text || `Đáp án ${letter}`}
                </span>
                {/* votes */}
                {revealed && (
                    <div className="text-right shrink-0 z-10 pl-[clamp(.5rem,1vw,1.5rem)] border-l border-slate-200">
                        <div className={clsx("font-black leading-none", isFaded ? "text-slate-400" : "text-slate-800")}
                            style={{ fontSize: 'clamp(1.5rem, 3vw, 3.5rem)', fontFamily: "Bebas Neue, Impact, sans-serif" }}>
                            {votes}
                        </div>
                        <div className={clsx("font-bold uppercase", isFaded ? "text-slate-400" : "text-slate-500")}
                            style={{ fontSize: 'clamp(.55rem, .8vw, .9rem)' }}>
                            {pct}%
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Advancing Grid (Người vượt qua) ──────────────────────────────────────────
function AdvancingGrid({ contestants, responses, correctAnswer }) {
    const advancing = (contestants ?? []).filter(c => {
        if (c.status === 'eliminated') return false;
        const r = responses?.[c.card_id];
        const ans = typeof r === 'object' ? r?.answer : r;
        return ans === correctAnswer;
    });
    if (!advancing.length || !correctAnswer) return null;
    return (
        <div className="w-full bg-white border-2 border-emerald-100 shadow-lg rounded-2xl animate-[psSlideUp_.6s_ease_.7s_both]"
            style={{ padding: 'clamp(.75rem,1.5vw,2rem)' }}>
            <div className="flex items-center gap-3 mb-[clamp(.5rem,1vw,1.25rem)] flex-wrap">
                <div className="bg-emerald-600 rounded-lg text-white font-extrabold tracking-wide uppercase shadow-sm"
                    style={{ padding: 'clamp(.3rem,.6vw,.75rem) clamp(.6rem,1.2vw,1.5rem)', fontSize: 'clamp(.65rem,1vw,1rem)' }}>
                    ✓ Vượt qua thử thách
                </div>
                <span className="text-slate-600 font-bold" style={{ fontSize: 'clamp(.75rem,1.1vw,1.15rem)' }}>
                    {advancing.length} Thí sinh
                </span>
            </div>
            <div className="max-h-[22vh] overflow-y-auto pr-1 custom-scrollbar">
                <div className="grid gap-[clamp(.25rem,.5vw,.5rem)]"
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(clamp(80px, 9vw, 140px), 1fr))` }}>
                    {advancing.map(c => (
                        <div key={c.id} className="bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold shadow-sm"
                            style={{ padding: 'clamp(.25rem,.5vw,.5rem) clamp(.4rem,.7vw,.75rem)' }}>
                            <div className="text-emerald-600 font-black font-mono" style={{ fontSize: 'clamp(.55rem,.8vw,.8rem)' }}>
                                #{String(c.card_id).padStart(2, '0')}
                            </div>
                            <div className="truncate" style={{ fontSize: 'clamp(.6rem,.85vw,.9rem)' }}>{c.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Step Numbers ──────────────────────────────────────────────────────────────
function StepNumbers({ questions, currentIndex }) {
    if (!questions.length) return null;
    return (
        <div className="flex items-center flex-wrap justify-end max-w-full" style={{ gap: 'clamp(2px,.3vw,6px)' }}>
            {questions.map((_, idx) => {
                const isCur = idx === currentIndex;
                const isDone = idx < currentIndex;
                return (
                    <div key={idx} className={clsx(
                        "rounded flex items-center justify-center font-bold font-mono transition-all",
                        isCur  ? "bg-blue-600 text-white shadow-md scale-110"
                             : isDone ? "bg-slate-200 text-slate-500"
                                      : "bg-white text-slate-400 border border-slate-200"
                    )} style={{ width: 'clamp(1.1rem,1.8vw,2rem)', height: 'clamp(1.1rem,1.8vw,2rem)', fontSize: 'clamp(.5rem,.75vw,.85rem)' }}>
                        {idx + 1}
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
export default function PresentationScreen() {
    const { state } = usePresentationChannel('receiver');
    const [showConfetti, setShowConfetti] = useState(false);
    const prevPhase = useRef(null);

    useEffect(() => {
        if (state?.phase === 'revealed' && prevPhase.current !== 'revealed') {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 8000);
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
    const eventName   = state?.eventName   || 'CÔNG AN TỈNH ĐẮK LẮK';
    const qIndex      = state?.questionIndex ?? 0;
    const qTotal      = state?.totalQuestions ?? 0;
    const contestants = state?.contestants ?? [];
    const responses   = state?.responses   ?? {};
    const totalVotes  = ANSWER_KEYS.reduce((s, k) => s + (votes[k] || 0), 0);

    const STATUS = {
        lobby:     { label: 'CHUẨN BỊ',           colors: 'text-amber-700 bg-amber-50 border-amber-300' },
        question:  { label: 'ĐỌC CÂU HỎI',        colors: 'text-blue-700 bg-blue-50 border-blue-300' },
        countdown: { label: 'THỜI GIAN SUY NGHĨ', colors: 'text-red-700 bg-red-50 border-red-300' },
        scanning:  { label: 'THU TÍN HIỆU',       colors: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-300', pulse: true },
        revealed:  { label: 'CÔNG BỐ ĐÁP ÁN',     colors: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
    };
    const st = STATUS[phase];

    return (
        <div className="fixed inset-0 z-[99999] w-screen h-screen overflow-hidden bg-slate-50 flex flex-col text-slate-800"
            style={{ fontFamily: "Nunito, Segoe UI, sans-serif" }}>

            {/* -- background pattern -- */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800;900&display=swap');
                @keyframes psSlideUp    { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
                @keyframes psFadeIn     { from { opacity:0 } to { opacity:1 } }
                @keyframes psZoomIn     { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
                @keyframes psScalePulse { 0%,100% { transform:scale(1) } 50% { transform:scale(1.06) } }
                @keyframes psPulseGlow  { 0%,100% { opacity:1 } 50% { opacity:.7 } }
                .custom-scrollbar::-webkit-scrollbar { width: 5px }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px }
            `}</style>

            {showConfetti && <Confetti />}

            {/* ═══ TOP BAR ═══ */}
            {phase !== 'idle' && phase !== 'lobby' && (
                <div className="relative z-10 shrink-0 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm animate-[psFadeIn_.5s_ease]"
                    style={{ padding: 'clamp(.5rem,1vh,1rem) clamp(.75rem,2vw,3rem)', gap: 'clamp(.5rem,1vw,1.5rem)' }}>

                    {/* Left: event info */}
                    <div className="flex items-center gap-[clamp(.5rem,1vw,1rem)] shrink min-w-0">
                        <div className="hidden sm:flex flex-col min-w-0">
                            <span className="font-bold text-slate-400 tracking-wider uppercase truncate"
                                style={{ fontSize: 'clamp(.5rem,.7vw,.7rem)' }}>Hội thi Rung Chuông Vàng</span>
                            <div className="font-black text-blue-900 tracking-wide uppercase truncate"
                                style={{ fontSize: 'clamp(.7rem,1.3vw,1.4rem)' }}>{eventName}</div>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-50 border border-red-200 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-[psPulseGlow_1.5s_infinite]" />
                            <span className="font-black text-red-600 uppercase tracking-widest" style={{ fontSize: 'clamp(.5rem,.7vw,.7rem)' }}>LIVE</span>
                        </div>
                    </div>

                    {/* Center: status badge */}
                    {st && (
                        <div className={clsx("rounded-full border font-black tracking-wider uppercase text-center shrink-0", st.colors,
                                st.pulse && "animate-[psPulseGlow_1.2s_infinite]")}
                            style={{ padding: 'clamp(.25rem,.5vw,.5rem) clamp(.6rem,1.5vw,1.5rem)', fontSize: 'clamp(.55rem,.8vw,.85rem)' }}>
                            {st.label}
                        </div>
                    )}

                    {/* Right: question progress */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="font-bold text-slate-400 uppercase tracking-wide" style={{ fontSize: 'clamp(.55rem,.85vw,.9rem)' }}>
                            Câu hỏi <span className="text-blue-600 font-black mx-0.5" style={{ fontSize: 'clamp(1rem,1.6vw,1.8rem)' }}>{qIndex + 1}</span> / {qTotal || questions.length}
                        </div>
                        <div className="hidden md:block"><StepNumbers questions={questions} currentIndex={qIndex} /></div>
                    </div>
                </div>
            )}

            {/* ═══ MAIN CONTENT ═══ */}
            <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden z-10 w-full"
                style={{ padding: 'clamp(.75rem,2vh,2.5rem) clamp(.75rem,3vw,4rem)', gap: 'clamp(.5rem,1.2vh,1.5rem)', maxWidth: '1920px', margin: '0 auto' }}>

                {/* ── IDLE ── */}
                {phase === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center animate-[psFadeIn_.8s_ease] p-8">
                        <img src="/images/rung-chuong-vang.png" alt="Rung Chuông Vàng"
                            className="w-full h-full max-w-4xl object-contain opacity-80"
                            onError={e => { e.target.style.display = 'none'; }} />
                    </div>
                )}

                {/* ── LOBBY ── */}
                {phase === 'lobby' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center animate-[psFadeIn_.8s_ease]"
                        style={{ padding: 'clamp(1rem,3vh,3rem)' }}>
                        <div className="text-center mb-[clamp(1.5rem,4vh,4rem)] animate-[psSlideUp_.6s_ease_.2s_both] w-full">
                            <h2 className="font-bold text-slate-500 tracking-widest uppercase"
                                style={{ fontSize: 'clamp(.9rem,2vw,2rem)', marginBottom: 'clamp(.25rem,.8vh,1rem)' }}>
                                Hội thi Chuyển đổi số
                            </h2>
                            <h1 className="font-black text-red-600 leading-none drop-shadow-md uppercase tracking-tight"
                                style={{ fontSize: 'clamp(2.5rem,8vw,8rem)' }}>
                                RUNG CHUÔNG VÀNG
                            </h1>
                            <div className="font-extrabold text-blue-800 uppercase tracking-wide"
                                style={{ fontSize: 'clamp(1rem,3vw,3rem)', marginTop: 'clamp(.5rem,1.5vh,1.5rem)' }}>
                                {eventName}
                            </div>
                        </div>
                        <div className="relative z-10 w-full flex flex-wrap items-center justify-center animate-[psSlideUp_.6s_ease_.4s_both]"
                            style={{ gap: 'clamp(1rem,3vw,3rem)' }}>
                            <div className="bg-white border border-slate-200 rounded-3xl text-center shadow-xl"
                                style={{ padding: 'clamp(1.5rem,3vw,3rem) clamp(2rem,4vw,5rem)' }}>
                                <div className="font-black text-blue-600 leading-none drop-shadow-sm"
                                    style={{ fontSize: 'clamp(3rem,7vw,8rem)' }}>{activeTotal}</div>
                                <div className="font-bold text-slate-500 uppercase tracking-widest"
                                    style={{ fontSize: 'clamp(.7rem,1.1vw,1.1rem)', marginTop: 'clamp(.25rem,.6vh,.75rem)' }}>Thí sinh</div>
                            </div>
                            {qTotal > 0 && (
                                <div className="bg-white border border-slate-200 rounded-3xl text-center shadow-xl"
                                    style={{ padding: 'clamp(1.5rem,3vw,3rem) clamp(2rem,4vw,5rem)' }}>
                                    <div className="font-black text-amber-500 leading-none drop-shadow-sm"
                                        style={{ fontSize: 'clamp(3rem,7vw,8rem)' }}>{qTotal}</div>
                                    <div className="font-bold text-slate-500 uppercase tracking-widest"
                                        style={{ fontSize: 'clamp(.7rem,1.1vw,1.1rem)', marginTop: 'clamp(.25rem,.6vh,.75rem)' }}>Câu hỏi</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── QUESTION / COUNTDOWN / SCANNING / REVEALED ── */}
                {phase !== 'idle' && phase !== 'lobby' && (<>

                    {/* Question box */}
                    <div className="w-full text-center animate-[psFadeIn_.5s_ease] shrink-0 bg-white border border-slate-200 rounded-2xl shadow-lg"
                        style={{ padding: 'clamp(.75rem,2vw,2.5rem) clamp(1rem,2.5vw,3rem)' }}>
                        <h2 className="font-extrabold text-slate-900 leading-snug m-0"
                            style={{ fontSize: question?.text?.length > 150 ? 'clamp(1.1rem,2.2vw,2.5rem)'
                                            : question?.text?.length > 80  ? 'clamp(1.3rem,2.8vw,3.2rem)'
                                            : 'clamp(1.5rem,3.5vw,4rem)' }}>
                            {question?.text || 'Đang đồng bộ dữ liệu...'}
                        </h2>
                    </div>

                    {/* ── QUESTION phase: chỉ đáp án ── */}
                    {phase === 'question' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 w-full animate-[psSlideUp_.5s_ease] flex-1 min-h-0 items-center"
                            style={{ gap: 'clamp(.4rem,1vw,1.5rem)' }}>
                            {ANSWER_KEYS.map((k, i) => (
                                <AnswerTile key={k} letter={k} text={question?.[`option_${k.toLowerCase()}`]}
                                    revealed={false} animDelay={i * 0.07} />
                            ))}
                        </div>
                    )}

                    {/* ── COUNTDOWN phase: timer + đáp án ── */}
                    {phase === 'countdown' && (
                        <div className="flex flex-col md:flex-row items-center justify-center w-full animate-[psZoomIn_.4s_ease] flex-1 min-h-0"
                            style={{ gap: 'clamp(.75rem,2vw,2.5rem)' }}>
                            <BigTimerRing seconds={timeLeft} total={timerTotal} />
                            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2" style={{ gap: 'clamp(.4rem,1vw,1.5rem)' }}>
                                {ANSWER_KEYS.map((k, i) => (
                                    <AnswerTile key={k} letter={k} text={question?.[`option_${k.toLowerCase()}`]}
                                        revealed={false} animDelay={i * 0.07} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── SCANNING phase: lưới thí sinh ── */}
                    {phase === 'scanning' && (
                        <div className="w-full flex-1 flex flex-col items-center min-h-0 animate-[psZoomIn_.4s_ease]"
                            style={{ gap: 'clamp(.5rem,1vw,1.5rem)' }}>
                            <div className="inline-flex items-center bg-white rounded-full shadow-md border border-fuchsia-200 shrink-0"
                                style={{ padding: 'clamp(.4rem,.8vw,.75rem) clamp(.75rem,1.5vw,2rem)', gap: 'clamp(.4rem,.7vw,.75rem)' }}>
                                <div className="w-3 h-3 rounded-full bg-fuchsia-500 animate-[psPulseGlow_1.2s_infinite]" />
                                <span className="font-black text-slate-700 uppercase tracking-widest"
                                    style={{ fontSize: 'clamp(.6rem,1vw,1.1rem)' }}>
                                    Đang thu nhận tín hiệu thẻ
                                </span>
                            </div>
                            <div className="w-full flex-1 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-y-auto custom-scrollbar"
                                style={{ padding: 'clamp(.5rem,1.2vw,1.5rem)' }}>
                                <div className="grid gap-[clamp(.2rem,.4vw,.4rem)]"
                                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(70px, 8vw, 130px), 1fr))' }}>
                                    {contestants.map(c => {
                                        const r = responses?.[c.card_id];
                                        const hasVoted = !!r;
                                        return (
                                            <div key={c.id} className={clsx(
                                                    "rounded-xl flex flex-col items-center justify-center transition-all duration-300 border",
                                                    hasVoted ? "bg-amber-100 text-amber-800 border-amber-400 shadow-md scale-[1.06] z-10"
                                                             : "bg-slate-50 text-slate-400 border-slate-200"
                                                )}
                                                style={{ padding: 'clamp(.25rem,.5vw,.5rem) clamp(.3rem,.5vw,.5rem)', aspectRatio: '5/2' }}>
                                                <div className="font-black font-mono leading-tight"
                                                    style={{ fontSize: 'clamp(.55rem,.9vw,.95rem)' }}>
                                                    #{String(c.card_id).padStart(2, '0')}
                                                </div>
                                                <div className={clsx("font-bold truncate w-full text-center mt-px",
                                                        hasVoted ? "text-amber-900" : "opacity-60")}
                                                    style={{ fontSize: 'clamp(.5rem,.75vw,.85rem)' }}>
                                                    {c.name}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── REVEALED phase: đáp án + kết quả + người vượt qua ── */}
                    {phase === 'revealed' && (
                        <div className="w-full flex-1 flex flex-col min-h-0" style={{ gap: 'clamp(.4rem,1vw,1.5rem)' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 shrink-0" style={{ gap: 'clamp(.4rem,1vw,1.5rem)' }}>
                                {ANSWER_KEYS.map((k, i) => (
                                    <AnswerTile key={k} letter={k} text={question?.[`option_${k.toLowerCase()}`]}
                                        revealed isCorrect={k === question?.correct_answer}
                                        votes={votes[k] || 0} totalVotes={totalVotes} animDelay={i * 0.07} />
                                ))}
                            </div>
                            <AdvancingGrid contestants={contestants} responses={responses} correctAnswer={question?.correct_answer} />
                        </div>
                    )}
                </>)}
            </div>

            {/* ═══ BOTTOM BAR — scan progress ═══ */}
            {phase !== 'idle' && phase !== 'lobby' && phase !== 'question' && activeTotal > 0 && (
                <div className="relative z-10 shrink-0 bg-white border-t border-slate-200 animate-[psFadeIn_.5s_ease]"
                    style={{ padding: 'clamp(.4rem,1vh,.75rem) clamp(.75rem,2vw,3rem) clamp(.5rem,1.2vh,1rem)' }}>
                    <div className="flex justify-between items-end" style={{ marginBottom: 'clamp(.2rem,.4vh,.4rem)' }}>
                        <span className="font-black text-slate-400 tracking-wider uppercase"
                            style={{ fontSize: 'clamp(.55rem,.8vw,.85rem)' }}>Tín hiệu nhận được</span>
                        <span className="font-black text-slate-500" style={{ fontSize: 'clamp(.7rem,1vw,1.1rem)' }}>
                            <span className={clsx("mr-0.5", scanned === activeTotal ? "text-emerald-600" : "text-blue-600")}
                                style={{ fontSize: 'clamp(1rem,1.8vw,2rem)' }}>{scanned}</span>
                            / {activeTotal}
                        </span>
                    </div>
                    <div className="rounded-full bg-slate-100 overflow-hidden shadow-inner" style={{ height: 'clamp(6px, .5vh, 12px)' }}>
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${activeTotal > 0 ? (scanned / activeTotal) * 100 : 0}%` }} />
                    </div>
                </div>
            )}
        </div>
    );
}