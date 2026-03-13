/**
 * Events.jsx — Quản lý cuộc thi & thí sinh
 *
 * Fixes:
 *  1. Fetch contestants riêng theo từng contestId vào cache local
 *     → không bị ghi đè bởi context, không mất data khi reload
 *  2. Nút "In / Tải thẻ QR" gọi backend PDF thực sự
 *     (downloadContestCards / downloadBlankCards từ context → client.js)
 */
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
    Trophy, Plus, X, UserPlus, Trash2, Search,
    Crown, XCircle, CheckCircle2, Hash,
    AlertTriangle, RefreshCw, QrCode, Printer,
    Users, BookOpen, Download, Loader2, Medal,
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_CFG = {
    active: { label: 'Đang thi', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    eliminated: { label: 'Bị loại', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    winner: { label: '🏆 Vô địch', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
};

// ─── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                <div className="px-6 py-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800 mb-1">{title}</h2>
                    <p className="text-sm text-slate-500">{message}</p>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                    <button onClick={onCancel}
                        className="flex-1 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
                        Huỷ
                    </button>
                    <button onClick={onConfirm}
                        className="flex-1 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl">
                        Xoá
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── EditDialog ────────────────────────────────────────────────────────────────
function EditDialog({ contest, onClose, onSave }) {
    const { banks } = useApp();
    const [name, setName] = useState(contest?.title || '');
    const [description, setDescription] = useState(contest?.description || '');
    const [bankId, setBankId] = useState(contest?.bank_id || '');
    const [maxContestants, setMaxContestants] = useState(contest?.max_contestants || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(contest.id, name.trim() || contest.title, description, bankId || null, maxContestants ? parseInt(maxContestants) : null);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-slate-800">Sửa thông tin cuộc thi</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tên cuộc thi</label>
                        <input autoFocus
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Tên cuộc thi..."
                            value={name} onChange={e => setName(e.target.value)}
                            disabled={saving} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Mô tả (tùy chọn)</label>
                        <textarea
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                            rows={3} placeholder="Mô tả cuộc thi..."
                            value={description} onChange={e => setDescription(e.target.value)}
                            disabled={saving} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Bộ câu hỏi</label>
                        <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                            value={bankId} onChange={e => setBankId(e.target.value)}
                            disabled={saving}
                        >
                            <option value="">-- Không có bộ câu hỏi --</option>
                            {banks.map(b => (
                                <option key={b.id} value={b.id}>{b.title || b.name} ({b.questions?.length || 0} câu)</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Số lượng tối đa người chơi (tùy chọn)</label>
                        <input type="number" min="1"
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Không giới hạn"
                            value={maxContestants} onChange={e => setMaxContestants(e.target.value)}
                            disabled={saving} />
                        {maxContestants && <p className="text-xs text-slate-500 mt-1">Tối đa {maxContestants} người chơi</p>}
                    </div>
                </div>
                <div className="px-6 py-4 border-t flex justify-end gap-3">
                    <button onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">Huỷ</button>
                    <button
                        disabled={saving}
                        onClick={handleSave}
                        className="px-6 py-2 text-sm text-white font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40">
                        {saving ? 'Đang lưu...' : 'Lưu'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CreateDialog ──────────────────────────────────────────────────────────────
function CreateDialog({ onClose, onSave }) {
    const { banks } = useApp();
    const [name, setName] = useState('');
    const [bankId, setBankId] = useState('');
    const [raw, setRaw] = useState('');
    const [saving, setSaving] = useState(false);
    const lines = raw.split('\n').filter(l => l.trim());

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(name.trim(), lines, bankId || null);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-slate-800">Tạo cuộc thi mới</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tên cuộc thi</label>
                        <input autoFocus
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                            placeholder="VD: Rung Chuông Vàng 2026..."
                            value={name} onChange={e => setName(e.target.value)}
                            disabled={saving} />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tuỳ chọn Ngân hàng câu hỏi</label>
                        <select
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                            value={bankId} onChange={e => setBankId(e.target.value)}
                            disabled={saving}
                        >
                            <option value="">-- Không chọn (Thêm sau) --</option>
                            {banks.map(b => (
                                <option key={b.id} value={b.id}>{b.title || b.name} ({b.questions?.length || 0} câu)</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                        Thẻ thí sinh được đánh số tự động từ <strong>#01</strong>.
                        Thẻ QR PDF được backend tạo trực tiếp theo số lượng cấu hình.
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Danh sách thí sinh
                            <span className="font-normal text-slate-400 ml-2">
                                ({lines.length} người — thẻ #01 → #{String(lines.length).padStart(2, '0')})
                            </span>
                        </label>
                        <p className="text-xs text-slate-400 mb-1.5">Mỗi tên một dòng, có thể dán thẳng từ Excel.</p>
                        <textarea
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-yellow-300 resize-none font-mono"
                            rows={8} placeholder={"Nguyễn Văn A\nTrần Thị B\nLê Văn C"}
                            value={raw} onChange={e => setRaw(e.target.value)}
                            disabled={saving} />
                    </div>
                </div>
                <div className="px-6 py-4 border-t flex justify-end gap-3">
                    <button onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">Huỷ</button>
                    <button
                        disabled={!name.trim() || saving}
                        onClick={handleSave}
                        className="px-6 py-2 text-sm text-white font-semibold rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40">
                        {saving ? 'Đang tạo...' : `Tạo (${lines.length} thí sinh)`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CardDownloadDialog — gọi backend PDF ─────────────────────────────────────
function CardDownloadDialog({ contest, contestantCount, onClose, onDownloadContest, onDownloadBlank }) {
    const [blankCount, setBlankCount] = useState(Math.max(contestantCount, 10));
    const [startId, setStartId] = useState(1);
    const [busyC, setBusyC] = useState(false);
    const [busyB, setBusyB] = useState(false);

    const doContest = async () => {
        setBusyC(true);
        try { await onDownloadContest(contest.id); }
        finally { setBusyC(false); }
    };
    const doBlank = async () => {
        setBusyB(true);
        try { await onDownloadBlank(blankCount, startId); }
        finally { setBusyB(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">In / Tải thẻ QR</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{contest.title}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Option A: PDF thẻ có tên từ backend */}
                    <div className="border border-slate-200 rounded-2xl p-4 hover:border-blue-300 hover:bg-blue-50/20 transition-all group">
                        <div className="flex gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Thẻ theo cuộc thi</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    PDF <strong>{contestantCount} thẻ</strong> — mỗi thẻ có tên + số + QR code.
                                    Backend tạo sẵn, tải về và in.
                                </p>
                            </div>
                        </div>
                        <button onClick={doContest} disabled={busyC || contestantCount === 0}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors">
                            {busyC
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo PDF...</>
                                : <><Download className="w-4 h-4" /> Tải PDF ({contestantCount} thẻ)</>}
                        </button>
                        {contestantCount === 0 && (
                            <p className="text-xs text-amber-600 text-center mt-2">⚠ Chưa có thí sinh trong cuộc thi</p>
                        )}
                    </div>

                    {/* Option B: Thẻ trắng */}
                    <div className="border border-slate-200 rounded-2xl p-4 hover:border-yellow-300 hover:bg-yellow-50/20 transition-all group">
                        <div className="flex gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0 group-hover:bg-yellow-100">
                                <QrCode className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Thẻ trắng (chỉ số)</p>
                                <p className="text-xs text-slate-500 mt-0.5">Dùng cho lượt chơi nhanh, không đăng ký tên.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mb-3">
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Số thẻ</label>
                                <input type="number" min={1} max={200}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                                    value={blankCount}
                                    onChange={e => setBlankCount(Math.max(1, +e.target.value || 1))} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">Bắt đầu từ #</label>
                                <input type="number" min={1}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                                    value={startId}
                                    onChange={e => setStartId(Math.max(1, +e.target.value || 1))} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 text-center mb-3">
                            Thẻ #{String(startId).padStart(2, '0')} → #{String(startId + blankCount - 1).padStart(2, '0')}
                        </p>
                        <button onClick={doBlank} disabled={busyB}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 disabled:opacity-40 transition-colors">
                            {busyB
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo PDF...</>
                                : <><Printer className="w-4 h-4" /> Tải {blankCount} thẻ trắng</>}
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 text-center">
                        Mở PDF bằng trình duyệt → Ctrl+P để in.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── AddContestantsDialog ──────────────────────────────────────────────────────
function AddDialog({ event, nextCardId, onClose, onSave }) {
    const [raw, setRaw] = useState('');
    const lines = raw.split('\n').filter(l => l.trim());
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-8 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 shrink-0 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Thêm thí sinh vào {event.title}</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Thẻ tiếp theo: #{String(nextCardId).padStart(2, '0')}
                            {lines.length > 0 && ` → #${String(nextCardId + lines.length - 1).padStart(2, '0')}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content: 2 columns */}
                <div className="flex-1 flex overflow-hidden min-h-[600px]">
                    {/* Left: Input section */}
                    <div className="w-2/5 flex flex-col border-r border-slate-200 p-5 bg-white">
                        <div className="mb-3">
                            <h3 className="text-sm font-bold text-slate-900 mb-1">Nhập danh sách tên</h3>
                            <p className="text-xs text-slate-600">
                                Mỗi thí sinh một dòng. Hỗ trợ copy-paste từ Excel hoặc Word. Mỗi dòng chứa một tên sinh viên — hệ thống sẽ tự động gán số thẻ.
                            </p>
                        </div>
                        <textarea autoFocus
                            className="flex-1 border border-blue-300 rounded-lg px-3 py-3 text-sm outline-none resize-none font-sans focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            placeholder={"Nguyễn Văn An\nTrần Thị Bình\nHoàng Văn C\nPhạm Thị D"}
                            value={raw} onChange={e => setRaw(e.target.value)} />
                        <p className="text-xs text-slate-400 mt-2">
                            💡 Tip: Bạn cũng có thể dán dữ liệu từ spreadsheet
                        </p>
                    </div>

                    {/* Right: Preview section */}
                    <div className="w-3/5 flex flex-col p-5 bg-slate-50 border-l border-slate-200">
                        <div className="mb-3">
                            <h3 className="text-sm font-bold text-slate-900 mb-1">Xem trước danh sách</h3>
                            <p className="text-xs text-slate-600">
                                {lines.length === 0 ? 'Nhập tên để xem trước' : `${lines.length} thí sinh sẽ được thêm`}
                            </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {lines.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-slate-400">
                                    <div className="text-center">
                                        <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs">Nhập tên để xem trước danh sách</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded overflow-hidden bg-white">
                                    <div className="grid grid-cols-2 gap-0 border-b border-slate-200 bg-slate-100">
                                        <div className="px-4 py-2 text-xs font-bold text-slate-700">Thẻ</div>
                                        <div className="px-4 py-2 text-xs font-bold text-slate-700 border-l border-slate-200">Họ và tên</div>
                                    </div>
                                    <div className="divide-y divide-slate-200">
                                        {lines.map((name, idx) => (
                                            <div key={idx} className="grid grid-cols-2 gap-0 hover:bg-yellow-50 transition-colors">
                                                <div className="px-4 py-3 text-xs font-bold text-yellow-700">
                                                    #{String(nextCardId + idx).padStart(2, '0')}
                                                </div>
                                                <div className="px-4 py-3 text-sm text-slate-800 border-l border-slate-200 font-semibold">
                                                    {name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0 bg-white">
                    <button onClick={onClose}
                        className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded transition-colors border border-slate-200">
                        Huỷ
                    </button>
                    <button
                        disabled={lines.length === 0}
                        onClick={() => { onSave(lines); onClose(); }}
                        className="px-6 py-2 text-sm text-slate-900 font-bold rounded bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        ✓ Thêm {lines.length > 0 ? lines.length : '0'} thí sinh
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Events() {
    const {
        contests,           // raw contests[] từ context
        activeSession,
        fetchContests,
        createContest,
        fetchContestants,   // (contestId?) → Promise<Contestant[]>
        addEvent,
        deleteContest,
        updateContest,
        addContestants,
        importContestants,
        removeContestant,
        setContestantStatus,
        startSession,
        resetContestants,
        session,
        downloadContestCards,   // (contestId) → tải PDF backend
        downloadBlankCards,     // (count, startId) → tải PDF backend
    } = useApp();

    // ── Local contestant cache — key: contestId, value: Contestant[]
    // Dùng cache local thay vì compat mapping từ context để tránh bị ghi đè
    const [cache, setCache] = useState({});
    const [loadingId, setLoadingId] = useState(null);

    const [activeId, setActiveId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [cardDialog, setCardDialog] = useState(null);
    const [addDialog, setAddDialog] = useState(null);
    const [editDialog, setEditDialog] = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState('contestants'); // 'contestants' | 'leaderboard'

    // ── Fetch contestants của 1 contest vào cache local ──────────────────────
    const loadContestants = async (contestId, force = false) => {
        if (!contestId) return;
        if (!force && cache[contestId] !== undefined) return; // dùng cache
        setLoadingId(contestId);
        try {
            const data = await fetchContestants(contestId);
            if (Array.isArray(data)) {
                setCache(prev => ({ ...prev, [contestId]: data }));
            }
        } finally {
            setLoadingId(null);
        }
    };

    // ── Mount: tải danh sách contests ────────────────────────────────────────
    useEffect(() => { fetchContests(); }, []); // eslint-disable-line

    // Khi contests thay đổi: chọn cái đầu tiên nếu chưa có activeId
    useEffect(() => {
        if (!activeId && contests.length > 0 && !activeSession) {
            setActiveId(contests[0].id);
        }
    }, [contests, activeId, activeSession]);

    // Force load nếu activeSession => activeId sync
    useEffect(() => {
        if (activeSession?.contest_id) {
            setActiveId(activeSession.contest_id);
        }
    }, [activeSession]);

    // Khi đổi activeId: fetch thí sinh vào cache
    useEffect(() => {
        if (activeId) loadContestants(activeId);
    }, [activeId]); // eslint-disable-line

    // ── Derived state ─────────────────────────────────────────────────────────
    const activeContest = contests.find(c => c.id === activeId);
    const allC = cache[activeId] ?? [];

    const displayed = allC.filter(c =>
        (filter === 'all' || c.status === filter) &&
        (c.name.toLowerCase().includes(search.toLowerCase()) ||
            String(c.card_id).includes(search))
    );

    const counts = {
        active: allC.filter(c => c.status === 'active').length,
        eliminated: allC.filter(c => c.status === 'eliminated').length,
        winner: allC.filter(c => c.status === 'winner').length,
    };

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchContests();
        if (activeId) await loadContestants(activeId, true); // force
        setRefreshing(false);
    };

    const handleCreate = async (name, lines, bankId) => {
        try {
            // 1. Tạo cuộc thi
            const contest = await createContest(name, '', bankId);
            if (!contest) {
                alert('Tạo cuộc thi thất bại');
                return;
            }

            // 2. Thêm thí sinh nếu có
            if (lines.length > 0) {
                await importContestants(contest.id, lines.join('\n'));
            }

            // 3. Fetch lại danh sách cuộc thi
            await fetchContests();

            // 4. Load contestants cho contest mới
            const fresh = await fetchContestants(contest.id);
            if (Array.isArray(fresh)) {
                setCache(prev => ({ ...prev, [contest.id]: fresh }));
            }

            // 5. Set active contest
            setActiveId(contest.id);
            setShowCreate(false);
        } catch (error) {
            console.error('Lỗi tạo cuộc thi:', error);
            alert(`Lỗi: ${error.message || 'Tạo cuộc thi thất bại'}`);
        }
    };

    const handleDelete = async (id) => {
        await deleteContest(id);
        setCache(prev => { const n = { ...prev }; delete n[id]; return n; });
        const rest = contests.filter(c => c.id !== id);
        setActiveId(rest[0]?.id ?? null);
        setConfirmDel(null);
    };

    const handleEdit = async (contestId, title, description, bankId, maxContestants) => {
        try {
            const updated = await updateContest(contestId, title, description, bankId, maxContestants);
            if (updated) {
                // Update active contest if it's the one being edited
                if (activeId === contestId) {
                    await fetchContests(); // Refresh to get latest data
                    // Reload contestants if activeId is set
                    if (activeId) {
                        const fresh = await fetchContestants(activeId);
                        if (Array.isArray(fresh)) setCache(prev => ({ ...prev, [activeId]: fresh }));
                    }
                }
                setEditDialog(null);
            }
        } catch (error) {
            console.error('Lỗi sửa cuộc thi:', error);
        }
    };

    const handleAddContestants = async (contestId, nameList) => {
        await addContestants(contestId, nameList);
        // Force reload để lấy card_id backend gán
        const fresh = await fetchContestants(contestId);
        if (Array.isArray(fresh)) setCache(prev => ({ ...prev, [contestId]: fresh }));
    };

    const handleRemove = async (contestantId) => {
        await removeContestant(activeId, contestantId);
        setCache(prev => ({
            ...prev,
            [activeId]: (prev[activeId] ?? []).filter(c => c.id !== contestantId),
        }));
    };

    const handleStatus = async (contestantId, status) => {
        await setContestantStatus(activeId, contestantId, status);
        setCache(prev => ({
            ...prev,
            [activeId]: (prev[activeId] ?? []).map(c =>
                c.id === contestantId ? { ...c, status } : c
            ),
        }));
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* HEADER */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 md:px-8 md:py-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-500 shrink-0" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Quản lý Cuộc thi</h1>
                        <p className="text-sm text-slate-500">
                            {contests.length} cuộc thi &nbsp;•&nbsp; {allC.length} thí sinh
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleRefresh} title="Tải lại từ server"
                        className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                        <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
                    </button>

                    {activeContest && (<>
                        {/* Nút in / tải thẻ QR — gọi backend PDF */}
                        <button onClick={() => setCardDialog(activeContest)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all">
                            <QrCode className="w-4 h-4 text-blue-500" />
                            In / Tải thẻ QR
                        </button>

                        {/* Nút sửa cuộc thi */}
                        <button onClick={() => setEditDialog(activeContest)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-yellow-50 hover:border-yellow-300 transition-all">
                            <span className="text-lg">⚙️</span> Chỉnh sửa
                        </button>

                        <button onClick={() => setAddDialog(activeContest)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all">
                            <UserPlus className="w-4 h-4" /> Thêm thí sinh
                        </button>

                        <button onClick={() => resetContestants(activeContest.id)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all">
                            🔄 Reset trạng thái
                        </button>

                        {session?.eventId !== activeContest.id ? (
                            <button onClick={() => startSession(activeContest.id)}
                                className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl bg-green-600 hover:bg-green-700 shadow-sm text-sm">
                                ▶ Bắt đầu phiên thi
                            </button>
                        ) : (
                            <span className="flex items-center gap-2 px-5 py-2.5 text-green-700 font-semibold rounded-xl bg-green-50 border border-green-200 text-sm">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Đang phát
                            </span>
                        )}

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                className="pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                                placeholder="Tìm thí sinh..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                    </>)}
                </div>
            </div>

            {/* BODY */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

                {/* Sidebar */}
                <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 bg-white overflow-y-auto shrink-0 max-h-44 md:max-h-none">
                    <div className="p-3 space-y-3">
                        <button onClick={() => setShowCreate(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-semibold rounded-xl bg-yellow-500 hover:bg-yellow-600 transition-colors text-sm">
                            <Plus className="w-4 h-4" /> Tạo cuộc thi
                        </button>
                        
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">
                                Danh sách ({contests.length})
                            </p>
                            <div className="space-y-1">
                                {contests.map(c => (
                                    <div key={c.id} className="group relative flex items-center gap-0.5 pr-1">
                                        <button onClick={() => setActiveId(c.id)}
                                            className={clsx(
                                                'flex-1 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                                                activeId === c.id
                                                    ? 'bg-yellow-500 text-white'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            )}>
                                            <Trophy className={clsx('w-3.5 h-3.5 shrink-0',
                                                activeId === c.id ? 'text-yellow-100' : 'text-yellow-500')} />
                                            <span className="truncate flex-1">{c.title}</span>
                                            {loadingId === c.id
                                                ? <Loader2 className="w-3 h-3 animate-spin opacity-60 shrink-0" />
                                                : <span className={clsx('text-xs font-semibold shrink-0',
                                                    activeId === c.id ? 'text-yellow-100' : 'text-slate-500')}>
                                                    {(cache[c.id] ?? []).length}
                                                </span>
                                            }
                                        </button>
                                        <button onClick={() => setConfirmDel(c.id)} title="Xoá cuộc thi"
                                            className={clsx(
                                                'p-2 rounded-lg transition-all shrink-0 flex items-center justify-center',
                                                activeId === c.id
                                                    ? 'hover:bg-yellow-600 text-white'
                                                    : 'text-red-600 hover:bg-red-100'
                                            )}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {contests.length === 0 && (
                                    <div className="text-center py-8">
                                        <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20 text-slate-300" />
                                        <p className="text-xs text-slate-400">Chưa có cuộc thi</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main panel */}
                <div className="flex-1 flex flex-col overflow-hidden">

                    {/* Tabs */}
                    {activeContest && (
                        <div className="bg-white border-b border-slate-200 px-4 flex gap-0 shrink-0">
                            <button onClick={() => setTab('contestants')}
                                className={clsx('px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
                                    tab === 'contestants' ? 'border-yellow-500 text-yellow-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                                <Users className="w-4 h-4" /> Người chơi
                                <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-bold',
                                    tab === 'contestants' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500')}>
                                    {allC.length}
                                </span>
                            </button>
                            <button onClick={() => setTab('leaderboard')}
                                className={clsx('px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2',
                                    tab === 'leaderboard' ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                                <Medal className="w-4 h-4" /> Bảng xếp hạng
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {!activeContest ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <Trophy className="w-16 h-16 mb-4 opacity-10 text-yellow-400" />
                                <p className="font-semibold text-slate-500">Chưa có cuộc thi nào</p>
                                <p className="text-sm mt-1">Nhấn "Tạo cuộc thi" để bắt đầu</p>
                            </div>
                        ) : loadingId === activeId ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-yellow-400" />
                                <p className="text-sm text-slate-400">Đang tải danh sách thí sinh...</p>
                            </div>
                        ) : tab === 'leaderboard' ? (
                            /* LEADERBOARD VIEW */
                            (() => {
                                const ranked = [...allC].sort((a, b) => {
                                    const diff = (b.correct_count ?? 0) - (a.correct_count ?? 0);
                                    if (diff !== 0) return diff;
                                    // Tie-break: active > eliminated > winner display priority doesn't matter, sort by name
                                    return a.name.localeCompare(b.name, 'vi');
                                });
                                const medalColors = ['#F59E0B', '#9CA3AF', '#CD7F32']; // gold, silver, bronze
                                return ranked.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <Medal className="w-12 h-12 mb-3 opacity-20" />
                                        <p className="font-medium">Chưa có dữ liệu xếp hạng</p>
                                    </div>
                                ) : (
                                    <div className="p-4 max-w-3xl mx-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b-2 border-slate-200">
                                                    <th className="text-left py-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-16">Hạng</th>
                                                    <th className="text-left py-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-16">Thẻ</th>
                                                    <th className="text-left py-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest">Họ và tên</th>
                                                    <th className="text-center py-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-28">Câu đúng</th>
                                                    <th className="text-center py-3 px-3 text-xs font-bold text-slate-400 uppercase tracking-widest w-28">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ranked.map((c, i) => {
                                                    // Calculate rank (same correct_count = same rank)
                                                    const rank = i === 0 ? 1
                                                        : (c.correct_count ?? 0) === (ranked[i - 1].correct_count ?? 0)
                                                            ? ranked.findIndex(r => (r.correct_count ?? 0) === (c.correct_count ?? 0)) + 1
                                                            : i + 1;
                                                    const sc = STATUS_CFG[c.status] || STATUS_CFG.active;
                                                    return (
                                                        <tr key={c.id} className={clsx('border-b border-slate-100 transition-colors',
                                                            rank <= 3 ? 'bg-amber-50/50' : 'hover:bg-slate-50')}>
                                                            <td className="py-3 px-3">
                                                                {rank <= 3 ? (
                                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                                                        style={{ backgroundColor: medalColors[rank - 1] }}>
                                                                        {rank}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 font-semibold pl-1.5">{rank}</span>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3 font-mono text-xs text-slate-500 font-bold">
                                                                #{String(c.card_id).padStart(2, '0')}
                                                            </td>
                                                            <td className="py-3 px-3 font-semibold text-slate-800">{c.name}</td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-xs">
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                    {c.correct_count ?? 0}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full border',
                                                                    sc.bg, sc.text, sc.border)}>
                                                                    {sc.label}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()
                        ) : displayed.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                <UserPlus className="w-12 h-12 mb-3 opacity-20" />
                                <p className="font-medium">
                                    {allC.length === 0 ? 'Chưa có thí sinh' : 'Không tìm thấy kết quả'}
                                </p>
                                {allC.length === 0 && (
                                    <button onClick={() => setAddDialog(activeContest)}
                                        className="mt-2 text-sm text-blue-600 hover:underline font-semibold">
                                        + Thêm thí sinh ngay
                                    </button>
                                )}
                            </div>
                        ) : (
                            /* GRID VIEW */
                            <div className="p-3 overflow-y-auto">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 md:gap-x-20 gap-y-4 text-sm">
                                    {displayed.map((c) => (
                                        <div key={c.id} className="border-b border-slate-300 pb-2 text-slate-700">
                                            <span className="font-semibold">#{String(c.card_id).padStart(2, '0')}. </span>
                                            <span>{c.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* DIALOGS */}
            {showCreate && (
                <CreateDialog onClose={() => setShowCreate(false)} onSave={handleCreate} />
            )}

            {editDialog && (
                <EditDialog
                    contest={editDialog}
                    onClose={() => setEditDialog(null)}
                    onSave={handleEdit} />
            )}

            {cardDialog && (
                <CardDownloadDialog
                    contest={cardDialog}
                    contestantCount={(cache[cardDialog.id] ?? []).length}
                    onClose={() => setCardDialog(null)}
                    onDownloadContest={downloadContestCards}
                    onDownloadBlank={downloadBlankCards} />
            )}

            {addDialog && (
                <AddDialog
                    event={addDialog}
                    nextCardId={allC.length + 1}
                    onClose={() => setAddDialog(null)}
                    onSave={names => handleAddContestants(addDialog.id, names)} />
            )}

            {confirmDel !== null && (
                <ConfirmDialog
                    title="Xoá cuộc thi?"
                    message={`"${contests.find(c => c.id === confirmDel)?.title}" và toàn bộ thí sinh sẽ bị xoá vĩnh viễn.`}
                    onConfirm={() => handleDelete(confirmDel)}
                    onCancel={() => setConfirmDel(null)} />
            )}
        </div>
    );
}