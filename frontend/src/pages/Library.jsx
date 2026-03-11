import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
    BookOpen, Plus, Trash2, ChevronDown, ChevronRight, ChevronUp,
    Check, GripVertical, X, AlertTriangle, Edit2
} from 'lucide-react';
import clsx from 'clsx';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = { A: '#E53E3E', B: '#3182CE', C: '#D69E2E', D: '#38A169' };
const EMPTY_Q = { text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', time_limit_sec: 30, is_backup: false };

// ── Confirm Delete Dialog ─────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="px-6 py-5 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <h2 className="text-base font-bold text-slate-800 mb-1">{title}</h2>
                    <p className="text-sm text-slate-500">{message}</p>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
                    >
                        Xoá
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Inline question card ──────────────────────────────────────────────────────
function QuestionCard({ bankId, question, index, total, onMoveUp, onMoveDown }) {
    const { updateQuestion, deleteQuestion } = useApp();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(question);
    const [confirmDel, setConfirmDel] = useState(false);

    const save = () => { updateQuestion(bankId, question.id, draft); setOpen(false); };

    return (
        <>
            <div className={clsx(
                'bg-white rounded-xl border transition-shadow text-sm',
                open ? 'shadow-lg border-blue-300' : 'shadow-sm border-slate-200'
            )}>
                <div className="flex items-center px-4 py-3 cursor-pointer select-none" onClick={() => setOpen(!open)}>
                    <GripVertical className="w-4 h-4 text-slate-300 mr-1.5 shrink-0" />
                    <span className="text-slate-400 font-bold w-6 shrink-0">{index + 1}.</span>
                    <p className={clsx('flex-1 truncate', !question.text && 'text-slate-400 italic')}>
                        {question.text || 'Câu hỏi chưa có nội dung'}
                    </p>
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-white ml-2"
                        style={{ backgroundColor: OPTION_COLORS[question.correct_answer] }}>
                        {question.correct_answer}
                    </span>
                    <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}
                        className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 ml-1 text-slate-400">
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1}
                        className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
                        className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded text-slate-300 ml-1">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
                {open && (
                    <div className="border-t border-slate-100 px-4 py-4 space-y-3">
                        <textarea
                            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none resize-none"
                            rows={2} placeholder="Nội dung câu hỏi..."
                            value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-2.5">
                            {OPTION_KEYS.map(k => {
                                const fk = `option_${k.toLowerCase()}`, isC = draft.correct_answer === k;
                                return (
                                    <div key={k} className={clsx(
                                        'flex items-center gap-2 rounded-lg border p-2 transition-all',
                                        isC ? 'border-green-400 bg-green-50' : 'border-slate-200'
                                    )}>
                                        <button onClick={() => setDraft(d => ({ ...d, correct_answer: k }))}
                                            className={clsx(
                                                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2 transition-colors',
                                                isC ? 'text-white border-green-500' : 'text-slate-500 border-slate-300'
                                            )}
                                            style={isC ? { backgroundColor: '#38A169', borderColor: '#38A169' } : {}}>
                                            {isC ? <Check className="w-3 h-3" /> : k}
                                        </button>
                                        <input
                                            className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400"
                                            placeholder={`Đáp án ${k}...`}
                                            value={draft[fk]}
                                            onChange={e => setDraft(d => ({ ...d, [fk]: e.target.value }))}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_backup"
                                checked={draft.is_backup || false}
                                onChange={e => setDraft(d => ({ ...d, is_backup: e.target.checked }))}
                                className="w-4 h-4"
                            />
                            <label htmlFor="is_backup" className="text-sm text-slate-600">Câu dự phòng</label>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setDraft(question); setOpen(false); }}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Huỷ</button>
                            <button onClick={save}
                                className="px-4 py-1.5 text-sm text-white rounded-lg font-semibold hover:opacity-90"
                                style={{ backgroundColor: '#10509F' }}>Lưu</button>
                        </div>
                    </div>
                )}
            </div>
            {confirmDel && (
                <ConfirmDialog
                    title="Xoá câu hỏi?"
                    message={`Câu ${index + 1}: "${question.text || 'Chưa có nội dung'}" sẽ bị xoá vĩnh viễn.`}
                    onConfirm={() => { deleteQuestion(bankId, question.id); setConfirmDel(false); }}
                    onCancel={() => setConfirmDel(false)}
                />
            )}
        </>
    );
}

// ── Question Set panel ─────────────────────────────────────────────────────────
function SetPanel({ set, onDeleteSet }) {
    const { addQuestion: addQuestionToBank, updateQuestion: updateQuestionInBank, deleteQuestion: deleteQuestionFromBank, updateBank } = useApp();
    const [open, setOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newQ, setNewQ] = useState(EMPTY_Q);
    const [confirmDel, setConfirmDel] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [editNameDraft, setEditNameDraft] = useState(set.title || set.name);

    const handleAdd = async () => {
        if (!newQ.text.trim()) return;
        await addQuestionToBank(set.id, { ...newQ, order_index: set.questions?.length + 1 || 1 });
        setNewQ(EMPTY_Q);
        setAdding(false);
    };

    const saveBankName = async () => {
        const newName = editNameDraft.trim();
        if (!newName) return;
        await updateBank(set.id, newName, set.description || '');
        setEditingName(false);
    };

    // API Bank backend hiện chưa hỗ trợ reorderQuestions dễ dàng qua endpoint PUT order
    const moveUp = i => { };
    const moveDown = i => { };

    return (
        <>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                {/* Set header */}
                <div className="flex items-center px-5 py-4 cursor-pointer select-none" onClick={() => setOpen(!open)}>
                    {open
                        ? <ChevronDown className="w-4 h-4 text-slate-400 mr-2" />
                        : <ChevronRight className="w-4 h-4 text-slate-400 mr-2" />
                    }
                    <div className="flex-1 min-w-0">
                        {editingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    className="font-bold text-slate-800 text-base outline-none bg-white border border-blue-300 rounded px-2 py-1 w-full"
                                    value={editNameDraft}
                                    onChange={e => setEditNameDraft(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') saveBankName();
                                        else if (e.key === 'Escape') { setEditingName(false); setEditNameDraft(set.title || set.name); }
                                    }}
                                    onBlur={saveBankName}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <p className="font-bold text-slate-800 text-base truncate">{set.title || set.name}</p>
                                <button
                                    onClick={e => { e.stopPropagation(); setEditingName(true); setEditNameDraft(set.title || set.name); }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-opacity"
                                    title="Sửa tên ngân hàng">
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-0.5">{set.questions?.length || 0} câu hỏi</p>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => { setOpen(true); setAdding(true); setNewQ(EMPTY_Q); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-90"
                            style={{ backgroundColor: '#10509F' }}>
                            <Plus className="w-3.5 h-3.5" /> Thêm câu
                        </button>
                        <button
                            onClick={() => setConfirmDel(true)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg border border-transparent hover:border-red-200 transition-all"
                            title="Xoá bộ câu hỏi">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {open && (
                    <div className="px-5 pb-5 space-y-2">
                        {/* Inline add form */}
                        {adding && (
                            <div className="bg-white rounded-xl border-2 border-blue-300 shadow p-4 space-y-3">
                                <textarea
                                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-300 outline-none resize-none"
                                    rows={2} placeholder="Nội dung câu hỏi..."
                                    value={newQ.text}
                                    onChange={e => setNewQ(d => ({ ...d, text: e.target.value }))}
                                    autoFocus
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    {OPTION_KEYS.map(k => {
                                        const fk = `option_${k.toLowerCase()}`, isC = newQ.correct_answer === k;
                                        return (
                                            <div key={k} className={clsx(
                                                'flex items-center gap-2 rounded-lg border p-2',
                                                isC ? 'border-green-400 bg-green-50' : 'border-slate-200'
                                            )}>
                                                <button
                                                    onClick={() => setNewQ(d => ({ ...d, correct_answer: k }))}
                                                    className={clsx(
                                                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border-2',
                                                        isC ? 'text-white border-green-500' : 'text-slate-500 border-slate-300'
                                                    )}
                                                    style={isC ? { backgroundColor: '#38A169', borderColor: '#38A169' } : {}}>
                                                    {isC ? <Check className="w-3 h-3" /> : k}
                                                </button>
                                                <input
                                                    className="flex-1 text-sm outline-none bg-transparent placeholder-slate-400"
                                                    placeholder={`Đáp án ${k}...`}
                                                    value={newQ[fk]}
                                                    onChange={e => setNewQ(d => ({ ...d, [fk]: e.target.value }))}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setAdding(false)}
                                        className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Huỷ</button>
                                    <button onClick={handleAdd}
                                        className="px-4 py-1.5 text-sm text-white rounded-lg font-semibold hover:opacity-90"
                                        style={{ backgroundColor: '#10509F' }}>Lưu câu hỏi</button>
                                </div>
                            </div>
                        )}

                        {(set.questions || []).map((q, i) => (
                            <QuestionCard
                                key={q.id} bankId={set.id} question={q}
                                index={i} total={set.questions?.length || 0}
                                onMoveUp={() => moveUp(i)} onMoveDown={() => moveDown(i)}
                            />
                        ))}

                        {(!set.questions || set.questions.length === 0) && !adding && (
                            <div className="text-center py-8 text-slate-400">
                                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Bộ này chưa có câu hỏi. Nhấn "Thêm câu" để bắt đầu.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {confirmDel && (
                <ConfirmDialog
                    title="Xoá ngân hàng câu hỏi?"
                    message={`"${set.title || set.name}" gồm ${set.questions?.length || 0} câu hỏi sẽ bị xoá vĩnh viễn. Không thể khôi phục.`}
                    onConfirm={() => { onDeleteSet(set.id); setConfirmDel(false); }}
                    onCancel={() => setConfirmDel(false)}
                />
            )}
        </>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Library() {
    const { banks, addBank, removeBank } = useApp();
    const [newSetName, setNewSetName] = useState('');
    const [showAddSet, setShowAddSet] = useState(false);

    const handleAddSet = () => {
        const name = newSetName.trim() || `Ngân hàng ${banks.length + 1}`;
        addBank(name);
        setNewSetName('');
        setShowAddSet(false);
    };

    const totalQ = banks.reduce((sum, s) => sum + (s.questions?.length || 0), 0);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <BookOpen className="w-6 h-6 shrink-0" style={{ color: '#10509F' }} />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Ngân hàng câu hỏi</h1>
                        <p className="text-sm text-slate-500">
                            {banks.length} ngân hàng &nbsp;•&nbsp; {totalQ} câu tổng cộng
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAddSet(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 shadow-sm"
                    style={{ backgroundColor: '#10509F' }}>
                    <Plus className="w-4 h-4" /> Tạo ngân hàng mới
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {/* Add set inline */}
                {showAddSet && (
                    <div className="bg-white border-2 border-blue-300 rounded-2xl p-5 shadow-lg flex gap-3 items-center">
                        <BookOpen className="w-5 h-5 text-blue-400 shrink-0" />
                        <input
                            autoFocus
                            className="flex-1 text-sm font-medium outline-none border-b border-slate-200 pb-1 placeholder-slate-400"
                            placeholder={`Tên ngân hàng (VD: Lịch sử - Địa lý)`}
                            value={newSetName}
                            onChange={e => setNewSetName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSet()}
                        />
                        <button onClick={() => setShowAddSet(false)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleAddSet}
                            className="px-4 py-1.5 text-sm text-white rounded-lg font-semibold hover:opacity-90"
                            style={{ backgroundColor: '#10509F' }}>
                            Tạo bộ
                        </button>
                    </div>
                )}

                {banks.map(set => (
                    <SetPanel
                        key={set.id}
                        set={set}
                        onDeleteSet={removeBank}
                    />
                ))}

                {banks.length === 0 && !showAddSet && (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Chưa có ngân hàng câu hỏi nào</p>
                        <p className="text-sm">Nhấn "Tạo ngân hàng mới" để cấu trúc đề thi</p>
                    </div>
                )}
            </div>
        </div>
    );
}