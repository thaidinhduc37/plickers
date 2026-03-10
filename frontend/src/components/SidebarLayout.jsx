import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    BookOpen, BarChart2, Radio, ShieldCheck, Trophy,
    LayoutDashboard, Scan, LogOut, Wifi, WifiOff, Camera
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import clsx from 'clsx';

const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { path: '/library', icon: BookOpen, label: 'Ngân hàng câu hỏi' },
    { path: '/events', icon: Trophy, label: 'Cuộc thi', gold: true },
    { path: '/live', icon: Radio, label: 'Phiên trực tiếp', live: true },
    { path: '/scanner', icon: Camera, label: 'Máy quét' },
    { path: '/reports', icon: BarChart2, label: 'Báo cáo' },
];

export default function SidebarLayout({ onLogout }) {
    const { contests, activeSession, wsConnected, cameraConnected } = useApp();
    const navigate = useNavigate();

    // Tìm contest đang live
    const liveContest = activeSession
        ? contests.find(c => c.id === activeSession.contest_id)
        : null;

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            <aside className="w-62 bg-white border-r border-slate-200 flex flex-col shadow-sm shrink-0" style={{ width: '248px' }}>

                {/* ── Logo ── */}
                <div className="h-16 flex items-center px-5 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg, #10509F 0%, #1a6fd4 100%)' }}>
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none block">ShieldPoll</span>
                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">Local Network Edition</span>
                        </div>
                    </div>
                </div>

                {/* ── Live Session Banner ── */}
                {activeSession && liveContest && (
                    <button
                        onClick={() => navigate('/live')}
                        className="mx-3 mt-3 px-3 py-2.5 rounded-xl text-left transition-all hover:opacity-90 shrink-0"
                        style={{ background: 'linear-gradient(135deg, #10509F 0%, #1a6fd4 100%)' }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Đang phát sóng</span>
                        </div>
                        <p className="text-xs font-bold text-white truncate">
                            {liveContest.title ?? liveContest.name}
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5">
                            Câu {(activeSession.current_question_index ?? 0) + 1} · Nhấn để điều khiển
                        </p>
                    </button>
                )}

                {/* ── Nav ── */}
                <nav className="flex-1 px-3 pt-3 space-y-0.5 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pb-1.5 pt-1">Menu</p>
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all',
                                isActive
                                    ? 'text-white font-semibold shadow-sm'
                                    : item.gold
                                        ? 'text-yellow-700 hover:bg-yellow-50'
                                        : item.live
                                            ? 'text-green-700 hover:bg-green-50'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            )}
                            style={({ isActive }) => isActive
                                ? {
                                    backgroundColor: item.gold ? '#EAB308'
                                        : item.live ? '#16a34a'
                                            : '#10509F'
                                }
                                : {}
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon className="w-4 h-4 shrink-0" />
                                    <span className="flex-1">{item.label}</span>
                                    {item.live && activeSession && !isActive && (
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* ── Connection status ── */}
                <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Kết nối</p>
                    <div className="flex items-center gap-2 text-xs">
                        <div className={clsx('flex items-center gap-1.5', wsConnected ? 'text-green-600' : 'text-slate-400')}>
                            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            <span className="font-medium">{wsConnected ? 'WebSocket' : 'Chưa kết nối'}</span>
                        </div>
                        <span className="text-slate-300">·</span>
                        <div className={clsx('flex items-center gap-1.5', cameraConnected ? 'text-green-600' : 'text-slate-400')}>
                            <Camera className="w-3 h-3" />
                            <span className="font-medium">{cameraConnected ? 'Camera OK' : 'Chưa có'}</span>
                        </div>
                    </div>
                </div>

                {/* ── Footer / User ── */}
                <div className="p-3 border-t border-slate-100 shrink-0">
                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors group">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg, #10509F, #1a6fd4)' }}
                        >A</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">Quản trị viên</p>
                            <p className="text-xs text-slate-400 truncate">Mạng nội bộ</p>
                        </div>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                title="Đăng xuất"
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-slate-300 transition-all"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            <main className="flex-1 overflow-hidden flex flex-col">
                <Outlet />
            </main>
        </div>
    );
}