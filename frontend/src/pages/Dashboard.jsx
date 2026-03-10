import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trophy, BookOpen, Users, Radio, Play, ChevronRight,
    TrendingUp, Clock, Award, Zap, BarChart2, CheckCircle2,
    AlertCircle, Circle
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, onClick }) {
    return (
        <button
            onClick={onClick}
            className="bg-white rounded-2xl border border-slate-200 p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group w-full"
        >
            <div className="flex items-start justify-between mb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color + '18' }}
                >
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{value}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">{label}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </button>
    );
}

// ── Live Session Banner ───────────────────────────────────────────────────────
function LiveBanner({ session, contests, onGo }) {
    const contest = contests.find(c => c.id === session?.contest_id);
    if (!session) return null;
    return (
        <div
            className="rounded-2xl p-5 flex items-center gap-4 shadow-lg"
            style={{
                background: 'linear-gradient(135deg, #10509F 0%, #1a6fd4 100%)',
            }}
        >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Đang phát sóng</span>
                </div>
                <p className="text-white font-bold text-base truncate">
                    {contest?.title ?? contest?.name ?? 'Phiên thi đang chạy'}
                </p>
                <p className="text-white/60 text-xs mt-0.5">
                    Câu {(session.current_question_index ?? 0) + 1}
                    {session.state === 'revealed' ? ' · Đã hiện đáp án' : ' · Đang chờ trả lời'}
                </p>
            </div>
            <button
                onClick={onGo}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 font-bold text-sm rounded-xl hover:bg-blue-50 transition-colors shrink-0"
            >
                <Play className="w-4 h-4" /> Vào điều khiển
            </button>
        </div>
    );
}

// ── Contest Row ───────────────────────────────────────────────────────────────
function ContestRow({ contest, onStart, isActive }) {
    const total = contest.contestants?.length ?? contest.contestant_count ?? 0;
    const active = contest.contestants?.filter(c => c.status === 'active').length ?? total;
    const qCount = contest.questions?.length ?? contest.question_count ?? 0;

    return (
        <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-green-100' : 'bg-yellow-50'}`}>
                <Trophy className={`w-4 h-4 ${isActive ? 'text-green-600' : 'text-yellow-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                    {contest.title ?? contest.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                    {total} thí sinh · {qCount} câu hỏi
                </p>
            </div>
            {isActive ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
                </span>
            ) : (
                <button
                    onClick={() => onStart(contest.id)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-all shrink-0"
                >
                    <Play className="w-3 h-3" /> Bắt đầu
                </button>
            )}
        </div>
    );
}

// ── Quick Action ──────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, desc, color, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all text-left group"
        >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: color + '15' }}>
                <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
    const { contests, contestants, activeSession, fetchContests, fetchContestants, startSession } = useApp();
    const navigate = useNavigate();
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        fetchContests();
        fetchContestants();
        const h = new Date().getHours();
        if (h < 12) setGreeting('Chào buổi sáng');
        else if (h < 18) setGreeting('Chào buổi chiều');
        else setGreeting('Chào buổi tối');
    }, []);

    // Stats
    const totalContests = contests.length;
    const totalQuestions = contests.reduce((s, c) => s + (c.questions?.length ?? c.question_count ?? 0), 0);
    const totalContestants = contestants.length;
    const activeCount = contestants.filter(c => c.status === 'active').length;

    const handleStart = async (contestId) => {
        await startSession(contestId);
        navigate('/live');
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                            {greeting}, <span style={{ color: '#10509F' }}>Admin</span> 👋
                        </h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Tổng quan hệ thống ShieldPoll
                        </p>
                    </div>
                    {!activeSession && (
                        <button
                            onClick={() => navigate('/events')}
                            className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl hover:opacity-90 shadow-sm text-sm"
                            style={{ backgroundColor: '#10509F' }}
                        >
                            <Zap className="w-4 h-4" /> Tạo cuộc thi mới
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">

                {/* Live banner */}
                {activeSession && (
                    <LiveBanner
                        session={activeSession}
                        contests={contests}
                        onGo={() => navigate('/live')}
                    />
                )}

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-4">
                    <StatCard
                        icon={Trophy}
                        label="Cuộc thi"
                        value={totalContests}
                        sub={totalContests === 0 ? 'Chưa có cuộc thi' : `${totalContests} cuộc thi đã tạo`}
                        color="#EAB308"
                        onClick={() => navigate('/events')}
                    />
                    <StatCard
                        icon={BookOpen}
                        label="Câu hỏi"
                        value={totalQuestions}
                        sub={`Trong ${contests.length} bộ đề`}
                        color="#10509F"
                        onClick={() => navigate('/library')}
                    />
                    <StatCard
                        icon={Users}
                        label="Thí sinh"
                        value={totalContestants}
                        sub={activeCount > 0 ? `${activeCount} đang thi` : 'Chưa có phiên nào'}
                        color="#38A169"
                        onClick={() => navigate('/events')}
                    />
                    <StatCard
                        icon={BarChart2}
                        label="Trạng thái"
                        value={activeSession ? 'Live' : 'Chờ'}
                        sub={activeSession ? 'Phiên đang chạy' : 'Chưa có phiên thi'}
                        color={activeSession ? '#38A169' : '#94a3b8'}
                        onClick={() => navigate('/live')}
                    />
                </div>

                {/* Main 2-col layout */}
                <div className="grid grid-cols-3 gap-6">

                    {/* Danh sách cuộc thi — 2/3 */}
                    <div className="col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-yellow-500" />
                                <h2 className="font-bold text-slate-800 text-sm">Cuộc thi gần đây</h2>
                            </div>
                            <button
                                onClick={() => navigate('/events')}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                            >
                                Xem tất cả <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="p-2">
                            {contests.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <Trophy className="w-10 h-10 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">Chưa có cuộc thi nào</p>
                                    <button
                                        onClick={() => navigate('/events')}
                                        className="mt-3 text-xs text-blue-600 hover:underline font-semibold"
                                    >
                                        Tạo cuộc thi đầu tiên →
                                    </button>
                                </div>
                            ) : (
                                contests.slice(0, 6).map(contest => (
                                    <ContestRow
                                        key={contest.id}
                                        contest={contest}
                                        onStart={handleStart}
                                        isActive={activeSession?.contest_id === contest.id}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Quick actions — 1/3 */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4" style={{ color: '#10509F' }} />
                                    <h2 className="font-bold text-slate-800 text-sm">Thao tác nhanh</h2>
                                </div>
                            </div>
                            <div className="p-3 space-y-2">
                                <QuickAction
                                    icon={Trophy}
                                    label="Tạo cuộc thi"
                                    desc="Thêm cuộc thi & thí sinh"
                                    color="#EAB308"
                                    onClick={() => navigate('/events')}
                                />
                                <QuickAction
                                    icon={BookOpen}
                                    label="Thêm câu hỏi"
                                    desc="Quản lý ngân hàng đề"
                                    color="#10509F"
                                    onClick={() => navigate('/library')}
                                />
                                <QuickAction
                                    icon={Radio}
                                    label="Bắt đầu phiên thi"
                                    desc="Chiếu trực tiếp"
                                    color="#38A169"
                                    onClick={() => navigate('/live')}
                                />
                                <QuickAction
                                    icon={BarChart2}
                                    label="Xem báo cáo"
                                    desc="Thống kê kết quả"
                                    color="#8B5CF6"
                                    onClick={() => navigate('/reports')}
                                />
                            </div>
                        </div>

                        {/* Tips box */}
                        <div
                            className="rounded-2xl p-4"
                            style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Award className="w-4 h-4 text-yellow-600" />
                                <p className="text-xs font-bold text-yellow-800">Mẹo sử dụng</p>
                            </div>
                            <p className="text-xs text-yellow-700 leading-relaxed">
                                In thẻ Plickers trong mục <strong>Cuộc thi</strong>, phát cho thí sinh và dùng camera để quét đáp án theo thời gian thực.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Thí sinh nổi bật — nếu có */}
                {contestants.filter(c => c.status === 'winner').length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                            <Award className="w-4 h-4 text-yellow-500" />
                            <h2 className="font-bold text-slate-800 text-sm">🏆 Người chiến thắng</h2>
                        </div>
                        <div className="p-4 flex flex-wrap gap-3">
                            {contestants
                                .filter(c => c.status === 'winner')
                                .map(c => (
                                    <div key={c.id} className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                                        <span className="text-lg">🏆</span>
                                        <div>
                                            <p className="text-sm font-bold text-yellow-800">{c.name}</p>
                                            <p className="text-xs text-yellow-600">Thẻ #{String(c.card_id).padStart(2, '0')}</p>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}