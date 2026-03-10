import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../context/AppContext';
import {
    Users, Plus, Trash2, QrCode, X, Search,
    ChevronDown, ChevronUp, UserPlus, Download
} from 'lucide-react';
import clsx from 'clsx';

// ----- Dialog: Tạo lớp mới -----
function AddClassDialog({ onClose, onSave }) {
    const [name, setName] = useState('');
    const [rawNames, setRawNames] = useState('');
    const count = rawNames.split('\n').filter(l => l.trim()).length;

    const handleSave = () => {
        if (!name.trim()) return;
        const list = rawNames.split('\n').filter(l => l.trim());
        onSave(name.trim(), list);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Thêm lớp học mới</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Tên lớp</label>
                        <input
                            autoFocus
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                            placeholder="VD: Lớp 10A1, Nhóm B..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Danh sách học sinh
                            <span className="font-normal text-slate-400 ml-2">({count} học sinh)</span>
                        </label>
                        <p className="text-xs text-slate-400 mb-2">Nhập mỗi tên trên một dòng, hoặc dán thẳng từ Excel.</p>
                        <textarea
                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none resize-none font-mono"
                            rows={10}
                            placeholder={"Nguyễn Văn A\nTrần Thị B\nLê Văn C\n..."}
                            value={rawNames}
                            onChange={e => setRawNames(e.target.value)}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Huỷ</button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="px-6 py-2 text-sm text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-40"
                        style={{ backgroundColor: '#10509F' }}>
                        Tạo lớp ({count === 0 ? '0' : count} HS)
                    </button>
                </div>
            </div>
        </div>
    );
}

// ----- Dialog: Thêm học sinh vào lớp -----
function AddStudentsDialog({ cls, onClose }) {
    const { addStudentsToClass } = useApp();
    const [rawNames, setRawNames] = useState('');
    const count = rawNames.split('\n').filter(l => l.trim()).length;

    const handleSave = () => {
        const list = rawNames.split('\n').filter(l => l.trim());
        addStudentsToClass(cls.id, list);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Thêm học sinh – {cls.name}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="px-6 py-5">
                    <p className="text-xs text-slate-400 mb-2">Nhập mỗi tên trên một dòng. Mã thẻ sẽ được gán tự động.</p>
                    <textarea
                        autoFocus
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none font-mono"
                        rows={8}
                        placeholder={"Nguyễn Văn D\nTrần Thị E"}
                        value={rawNames}
                        onChange={e => setRawNames(e.target.value)}
                    />
                </div>
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Huỷ</button>
                    <button onClick={handleSave} disabled={count === 0}
                        className="px-6 py-2 text-sm text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-40"
                        style={{ backgroundColor: '#10509F' }}>
                        Thêm {count} học sinh
                    </button>
                </div>
            </div>
        </div>
    );
}

// ----- Dialog: In mã QR -----
function QRPrintDialog({ cls, onClose, apiBase }) {
    const { session } = useApp();
    const sessionId = session?.id || 1; // fallback

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Mã QR học sinh – {cls.name}</h2>
                        <p className="text-sm text-slate-500">In trang này và phát cho học sinh. Mỗi em quét mã để gửi đáp án.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90"
                            style={{ backgroundColor: '#10509F' }}>
                            <Download className="w-4 h-4" /> In thẻ
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="overflow-y-auto p-6 flex-1" id="qr-print-area">
                    <div className="grid grid-cols-4 gap-4 print:grid-cols-4">
                        {cls.students.map(student => {
                            const scanUrl = `${apiBase}/scan?student_id=${student.assigned_card_id}`;
                            return (
                                <div key={student.id}
                                    className="border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3 bg-white shadow-sm print:border print:shadow-none">
                                    {/* Labels A B C D ở 4 góc */}
                                    <div className="relative w-full">
                                        <div className="absolute -top-1 left-0 text-xs font-black text-slate-400">A</div>
                                        <div className="absolute -top-1 right-0 text-xs font-black text-slate-400">B</div>
                                        <div className="flex justify-center py-2">
                                            <QRCodeSVG
                                                value={scanUrl}
                                                size={120}
                                                level="M"
                                                includeMargin
                                            />
                                        </div>
                                        <div className="absolute -bottom-1 left-0 text-xs font-black text-slate-400">D</div>
                                        <div className="absolute -bottom-1 right-0 text-xs font-black text-slate-400">C</div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-800 truncate max-w-full">{student.name}</p>
                                        <p className="text-xs text-slate-400">Mã thẻ: <span className="font-semibold text-[#10509F]">#{student.assigned_card_id}</span></p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// -----  Trang chính: Lớp học -----
export default function Classes() {
    const { classes, activeClassId, setActiveClassId, addClass, deleteClass, removeStudentFromClass, apiBase } = useApp();
    const [showAddClass, setShowAddClass] = useState(false);
    const [addStudentsFor, setAddStudentsFor] = useState(null); // class object
    const [showQRFor, setShowQRFor] = useState(null);    // class object
    const [search, setSearch] = useState('');
    const [expandedClass, setExpandedClass] = useState(null);

    const activeClass = classes.find(c => c.id === activeClassId);

    const filtered = (activeClass?.students || []).filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        String(s.assigned_card_id).includes(search)
    );

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 shrink-0" style={{ color: '#10509F' }} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Quản lý Lớp học</h1>
                        <p className="text-sm text-slate-500">{classes.length} lớp  •  {activeClass?.students.length ?? 0} học sinh trong lớp hiện tại</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeClass && (
                        <>
                            <button onClick={() => setShowQRFor(activeClass)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                                <QrCode className="w-4 h-4" /> In mã QR
                            </button>
                            <button onClick={() => setAddStudentsFor(activeClass)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                                <UserPlus className="w-4 h-4" /> Thêm học sinh
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowAddClass(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 shadow-sm"
                        style={{ backgroundColor: '#10509F' }}>
                        <Plus className="w-4 h-4" /> Tạo lớp mới
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar: danh sách lớp */}
                <div className="w-56 border-r border-slate-200 bg-white flex flex-col overflow-hidden shrink-0">
                    <div className="p-3 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">Danh sách lớp</p>
                        <div className="space-y-1">
                            {classes.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setActiveClassId(c.id)}
                                    className={clsx(
                                        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group',
                                        activeClassId === c.id ? 'text-white' : 'text-slate-600 hover:bg-slate-50'
                                    )}
                                    style={activeClassId === c.id ? { backgroundColor: '#10509F' } : {}}
                                >
                                    <span className="truncate">{c.name}</span>
                                    <span className={clsx('text-xs ml-1 shrink-0', activeClassId === c.id ? 'text-blue-200' : 'text-slate-400')}>
                                        {c.students.length}HS
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main: bảng học sinh */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search */}
                    <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-4 shrink-0">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên hoặc mã thẻ..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                            />
                        </div>
                        {activeClass && (
                            <p className="text-sm text-slate-500">
                                Lớp <span className="font-semibold text-slate-800">{activeClass.name}</span>
                                {' '} – {activeClass.students.length} học sinh
                            </p>
                        )}
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto">
                        {!activeClass ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Users className="w-12 h-12 mb-3 opacity-30" />
                                <p className="font-medium">Chưa có lớp nào</p>
                                <p className="text-sm">Nhấn "Tạo lớp mới" để bắt đầu</p>
                            </div>
                        ) : activeClass.students.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <UserPlus className="w-12 h-12 mb-3 opacity-30" />
                                <p className="font-medium">Lớp chưa có học sinh</p>
                                <p className="text-sm">Nhấn "Thêm học sinh" để nhập danh sách</p>
                            </div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left w-12">STT</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">Họ và tên</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Mã thẻ</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Mã QR</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Trả lời gần nhất</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((s, i) => {
                                        const scanUrl = `${apiBase}/scan?student_id=${s.assigned_card_id}`;
                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 text-sm text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                            style={{ backgroundColor: '#10509F' }}>
                                                            {s.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-800">{s.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">
                                                        #{String(s.assigned_card_id).padStart(2, '0')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex justify-center">
                                                        <QRCodeSVG value={scanUrl} size={40} level="M" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.hasResponded ? (
                                                        <span className="bg-blue-50 text-blue-700 text-sm font-bold px-3 py-1 rounded-full">{s.answer}</span>
                                                    ) : (
                                                        <span className="text-slate-300 text-sm">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => removeStudentFromClass(activeClassId, s.id)}
                                                        className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg text-slate-300 transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Dialogs */}
            {showAddClass && (
                <AddClassDialog
                    onClose={() => setShowAddClass(false)}
                    onSave={(name, list) => {
                        const newId = addClass(name, list);
                        setActiveClassId(newId);
                    }}
                />
            )}
            {addStudentsFor && (
                <AddStudentsDialog
                    cls={addStudentsFor}
                    onClose={() => setAddStudentsFor(null)}
                />
            )}
            {showQRFor && (
                <QRPrintDialog
                    cls={showQRFor}
                    onClose={() => setShowQRFor(null)}
                    apiBase={apiBase}
                />
            )}
        </div>
    );
}
