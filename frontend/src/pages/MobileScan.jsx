import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  User, 
  Hash, 
  HelpCircle,
  SendHorizontal
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TOKEN = 'shieldpoll_secret_token';

const ANSWER_COLORS = {
    A: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444', shadow: 'rgba(239, 68, 68, 0.2)' },
    B: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.2)' },
    C: { bg: 'rgba(234, 179, 8, 0.1)', border: '#eab308', text: '#eab308', shadow: 'rgba(234, 179, 8, 0.2)' },
    D: { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', text: '#22c55e', shadow: 'rgba(34, 197, 94, 0.2)' },
};

export default function MobileScan() {
    const [params] = useSearchParams();
    const studentId = Number(params.get('student_id') ?? -1);

    const [session, setSession] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/session/active`, {
                    headers: { Authorization: `Bearer ${TOKEN}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    // Reset trạng thái submit nếu session đổi sang câu hỏi mới
                    if (session && session.current_question_index !== data.current_question_index) {
                        setSubmitted(false);
                        setSelected(null);
                    }
                    setSession(data);
                } else {
                    setError('Chưa có phiên học nào đang diễn ra.');
                }
            } catch {
                setError('Lỗi kết nối máy chủ.');
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
        const interval = setInterval(fetchSession, 3000); // Poll nhanh hơn để mượt
        return () => clearInterval(interval);
    }, [session]);

    const handleAnswer = async (answer) => {
        if (!session || submitted) return;
        setSelected(answer);
        try {
            const res = await fetch(`${API_BASE}/api/scan/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${TOKEN}`,
                },
                body: JSON.stringify({
                    session_id: session.session_id,
                    results: [{ card_id: studentId, answer }]
                }),
            });
            if (res.ok) {
                setSubmitted(true);
            } else {
                const data = await res.json();
                setError(data.detail || 'Lỗi khi gửi đáp án.');
                setSelected(null);
            }
        } catch {
            setError('Lỗi kết nối. Thử lại nhé!');
            setSelected(null);
        }
    };

    if (loading) return (
        <div style={styles.fullScreen}>
            <Loader2 size={40} color="#3b82f6" className="animate-spin" />
            <p style={{ marginTop: 16, color: '#94a3b8' }}>Đang chuẩn bị phòng thi...</p>
        </div>
    );

    if (studentId < 0) return (
        <div style={styles.fullScreen}>
            <div style={styles.statusCard}>
                <AlertCircle size={48} color="#ef4444" />
                <h2 style={styles.statusTitle}>Thẻ không hợp lệ</h2>
                <p style={styles.statusText}>Bạn cần quét đúng mã QR cá nhân để tham gia trả lời.</p>
            </div>
        </div>
    );

    if (submitted) return (
        <div style={styles.fullScreen}>
            <div style={styles.statusCard}>
                <div style={{ ...styles.successIcon, borderColor: ANSWER_COLORS[selected].border }}>
                    <span style={{ color: ANSWER_COLORS[selected].text, fontSize: 40, fontWeight: 900 }}>{selected}</span>
                </div>
                <h2 style={styles.statusTitle}>Đã ghi nhận!</h2>
                <p style={styles.statusText}>Bạn đã chọn đáp án <b>{selected}</b>. Hãy chờ giáo viên công bố kết quả nhé!</p>
                <div style={styles.waitingDots}>
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    );

    return (
        <div style={styles.container}>
            {/* Top Bar */}
            <div style={styles.topBar}>
                <div style={styles.studentBadge}>
                    <User size={14} />
                    <span>ID: {String(studentId).padStart(2, '0')}</span>
                </div>
                <div style={styles.questionBadge}>
                    <Hash size={14} />
                    <span>Câu {(session?.current_question_index ?? 0) + 1}</span>
                </div>
            </div>

            {/* Question Card */}
            <div style={styles.questionSection}>
                <div style={styles.questionIcon}><HelpCircle color="#3b82f6" /></div>
                <h1 style={styles.questionText}>
                    {session?.current_question?.text || 'Đang chờ giáo viên đưa ra câu hỏi...'}
                </h1>
            </div>

            {/* Answer Grid */}
            <div style={styles.answerGrid}>
                {['A', 'B', 'C', 'D'].map(k => {
                    const optKey = `option_${k.toLowerCase()}`;
                    const label = session?.current_question?.[optKey] || `Đáp án ${k}`;
                    const c = ANSWER_COLORS[k];
                    const isSel = selected === k;
                    
                    return (
                        <button
                            key={k}
                            onClick={() => handleAnswer(k)}
                            disabled={!!selected || !session?.current_question}
                            style={{
                                ...styles.answerBtn,
                                backgroundColor: isSel ? c.bg : '#1e293b',
                                borderColor: isSel ? c.border : '#334155',
                                boxShadow: isSel ? `0 0 15px ${c.shadow}` : 'none',
                                transform: isSel ? 'scale(0.98)' : 'none'
                            }}
                        >
                            <div style={{ ...styles.letterBox, backgroundColor: isSel ? c.border : '#0f172a', color: isSel ? '#fff' : '#94a3b8' }}>
                                {k}
                            </div>
                            <span style={{ ...styles.labelText, color: isSel ? c.text : '#f1f5f9' }}>{label}</span>
                            {isSel && <SendHorizontal size={18} color={c.text} style={{ marginLeft: 'auto' }} />}
                        </button>
                    );
                })}
            </div>

            {error && <div style={styles.errorFloat}>{error}</div>}

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.5; }
                }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

const styles = {
    fullScreen: { minHeight: '100svh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' },
    container: { minHeight: '100svh', background: '#0f172a', display: 'flex', flexDirection: 'column', padding: '16px' },
    topBar: { display: 'flex', justifyContent: 'space-between', marginBottom: 24, gap: 10 },
    studentBadge: { display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', color: '#94a3b8', padding: '6px 12px', borderRadius: '12px', fontSize: 13, fontWeight: 600 },
    questionBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '6px 12px', borderRadius: '12px', fontSize: 13, fontWeight: 700 },
    
    questionSection: { background: '#1e293b', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', marginBottom: 24, border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' },
    questionIcon: { width: 40, height: 40, background: 'rgba(59,130,246,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
    questionText: { color: '#f8fafc', fontSize: '20px', fontWeight: 700, lineHeight: 1.4 },
    
    answerGrid: { display: 'flex', flexDirection: 'column', gap: 12, flex: 1 },
    answerBtn: { display: 'flex', alignItems: 'center', gap: 16, padding: '14px', borderRadius: '20px', border: '2px solid', transition: 'all 0.2s ease', textAlign: 'left', cursor: 'pointer' },
    letterBox: { width: 44, height: 44, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, flexShrink: 0 },
    labelText: { fontSize: '16px', fontWeight: 600, flex: 1 },
    
    statusCard: { background: '#1e293b', padding: '40px 24px', borderRadius: '32px', width: '100%', maxWidth: 320, border: '1px solid #334155' },
    statusTitle: { color: '#f8fafc', fontSize: '24px', fontWeight: 800, margin: '20px 0 8px' },
    statusText: { color: '#94a3b8', fontSize: '15px', lineHeight: 1.5 },
    successIcon: { width: 80, height: 80, borderRadius: '50%', border: '4px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' },
    
    waitingDots: { display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 },
    errorFloat: { position: 'fixed', bottom: 20, left: 20, right: 20, background: '#ef4444', color: '#fff', padding: '12px', borderRadius: '12px', fontSize: 14, textAlign: 'center', boxShadow: '0 10px 15px rgba(239,68,68,0.3)' }
};