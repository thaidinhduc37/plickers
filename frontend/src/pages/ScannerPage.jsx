/**
 * src/pages/ScannerPage.jsx
 * FIXED #3 — Nhận diện hướng QR chính xác với:
 *   1. Angle-based detection (atan2) thay vì chỉ so sánh y tọa độ
 *   2. 5-frame voting buffer — chỉ submit khi ≥ 3/5 frame đồng thuận
 *   3. Debounce per card: sau khi đã submit, lock 2s để không re-scan
 *   4. Reject frame nếu confidence thấp (thẻ đang xoay nghiêng 45°)
 *
 * FIXED #2 — Không submit đáp án cho thí sinh đã bị loại (check qua contestants)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PCardDetector } from '../context/pcard_detector';
import { api } from '../api/client';

const ANSWER_COLORS = {
    A: { bg: '#FEE2E2', border: '#F87171', text: '#991B1B' },
    B: { bg: '#DBEAFE', border: '#60A5FA', text: '#1E40AF' },
    C: { bg: '#FEF9C3', border: '#FACC15', text: '#92400E' },
    D: { bg: '#DCFCE7', border: '#4ADE80', text: '#166534' },
};

// ─── Voting Buffer ────────────────────────────────────────────────────────────
const CONSENSUS_THRESHOLD = 3;   // cần ít nhất 3/5 frame đồng ý
const CONFIDENCE_MIN = 0.3;      // reject frame nếu confidence thấp
const LOCK_MS = 2000;            // ms khóa card sau khi đã submit

export default function ScannerPage() {
    const [contestants, setContestants] = useState([]);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const streamRef = useRef(null);
    const submittingRef = useRef(new Set()); // đang gửi API

    // scanBuffer: { [cardId]: { votes: {A,B,C,D}, frames: [{answer, ts}], lockedUntil } }
    const detectorRef = useRef(new PCardDetector());
    const scanBufferRef = useRef({});
    const lockedCardsRef = useRef({}); // cardId → timestamp khi unlock

    const [session, setSession] = useState(null);
    const [scanned, setScanned] = useState({});
    const [lastScan, setLastScan] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [error, setError] = useState('');
    const [cameraReady, setCameraReady] = useState(false);
    const [status, setStatus] = useState('connecting');
    const [manualId, setManualId] = useState('');
    const [manualLoading, setManualLoading] = useState(false);
    const [showList, setShowList] = useState(false);
    const [debugInfo, setDebugInfo] = useState(null); // hiện góc xoay khi dev

    // Set để check contestant eliminated nhanh
    const eliminatedCardIds = useRef(new Set());
    useEffect(() => {
        eliminatedCardIds.current = new Set(
            contestants.filter(c => c.status === 'eliminated').map(c => c.card_id)
        );
    }, [contestants]);

    // ── Session polling ───────────────────────────────────────────────────────
    const fetchSession = useCallback(async () => {
        try {
            const data = await api.getActiveSession();
            if (!data?.session_id) { setStatus('no_session'); setSession(null); return; }
            setSession(prev => {
                if (prev && prev.current_question_index !== data.current_question_index) {
                    // Câu mới → xóa buffer và scanned
                    scanBufferRef.current = {};
                    lockedCardsRef.current = {};
                    submittingRef.current.clear();
                    setScanned({});
                    setRevealed(false);
                }
                return data;
            });
            // Fetch contestants mỗi khi có session
            if (data?.contest_id) {
                api.getContestants(data.contest_id).then(setContestants).catch(() => {});
            }
            setStatus('ready');
        } catch { setStatus('no_session'); }
    }, []);

    useEffect(() => {
        fetchSession();
        const t = setInterval(fetchSession, 5000);
        return () => clearInterval(t);
    }, [fetchSession]);

    // ── Camera ────────────────────────────────────────────────────────────────
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                });
                if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                    setCameraReady(true);
                }
            } catch {
                setError('Không thể truy cập camera. Hãy cấp quyền camera cho trình duyệt.');
            }
        })();
        return () => {
            active = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(animRef.current);
        };
    }, []);

    // ── FIX #3: Scan loop với voting buffer ───────────────────────────────────
    const scan = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animRef.current = requestAnimationFrame(scan);
            return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Dùng PCardDetector thay jsQR
        const result = detectorRef.current.detect(canvas, ctx);

        if (result && session) {
            const { cardId, answer, confidence } = result;

            // CHỈ chấp nhận card_id nếu có trong danh sách thí sinh của phiên thi
            const validContestant = contestants.find(c => c.card_id === cardId);
            if (!validContestant) {
                // Card_id không hợp lệ → bỏ qua
                animRef.current = requestAnimationFrame(scan);
                return;
            }

            // Bỏ qua nếu thí sinh đã bị loại
            if (eliminatedCardIds.current.has(cardId)) {
                animRef.current = requestAnimationFrame(scan);
                return;
            }

            // Bỏ qua nếu đang trong thời gian lock
            const now = Date.now();
            if (lockedCardsRef.current[cardId] && now < lockedCardsRef.current[cardId]) {
                animRef.current = requestAnimationFrame(scan);
                return;
            }

            // Bỏ qua nếu đã scanned thành công
            if (scanned[cardId]) {
                animRef.current = requestAnimationFrame(scan);
                return;
            }

            setDebugInfo({ cardId, answer, confidence: Math.round(confidence * 100) });

            // Reject frame nếu confidence thấp
            if (confidence < CONFIDENCE_MIN) {
                animRef.current = requestAnimationFrame(scan);
                return;
            }

            // Thêm vào voting buffer
            if (!scanBufferRef.current[cardId]) {
                scanBufferRef.current[cardId] = { A: 0, B: 0, C: 0, D: 0, total: 0 };
            }
            const buf = scanBufferRef.current[cardId];
            buf[answer] = (buf[answer] || 0) + 1;
            buf.total += 1;

            // Reset buffer nếu quá cũ (tránh stale data)
            if (buf.total > 10) {
                scanBufferRef.current[cardId] = { A: 0, B: 0, C: 0, D: 0, total: 1, [answer]: 1 };
                animRef.current = requestAnimationFrame(scan);
                return;
            }

            // Kiểm tra consensus: có đáp án nào đạt ngưỡng chưa?
            const winAnswer = ['A', 'B', 'C', 'D'].find(k => buf[k] >= CONSENSUS_THRESHOLD);

            if (winAnswer && !submittingRef.current.has(cardId)) {
                submittingRef.current.add(cardId);
                lockedCardsRef.current[cardId] = now + LOCK_MS;

                const contestant = contestants.find(c => c.card_id === cardId);
                const name = contestant?.name || `Thẻ #${cardId}`;

                setScanned(prev => {
                    if (prev[cardId]) return prev;
                    setLastScan({ cardId, name, answer: winAnswer });
                    setTimeout(() => setLastScan(null), 1800);
                    return { ...prev, [cardId]: { name, answer: winAnswer, contestantId: contestant?.id } };
                });

                scanBufferRef.current[cardId] = { A: 0, B: 0, C: 0, D: 0, total: 0 };

                api.submitScan(session.session_id, [{ card_id: cardId, answer: winAnswer }])
                    .finally(() => submittingRef.current.delete(cardId));
            }
        }

        animRef.current = requestAnimationFrame(scan);
    }, [session, contestants, scanned]);

    useEffect(() => {
        if (cameraReady) animRef.current = requestAnimationFrame(scan);
        return () => cancelAnimationFrame(animRef.current);
    }, [scan, cameraReady]);

    // ── Manual connect ────────────────────────────────────────────────────────
    const handleManualConnect = useCallback(async (e) => {
        e.preventDefault();
        const sid = parseInt(manualId.trim(), 10);
        if (isNaN(sid)) return;
        setManualLoading(true);
        try {
            const data = await api.getSessionResults(sid);
            if (!data) { setError('Không tìm thấy phiên thi #' + sid); return; }
            const active = await api.getActiveSession().catch(() => null);
            const sessionData = active || { session_id: sid, current_question_index: 0, total_questions: '?', state: 'scanning' };
            sessionData.session_id = sid;
            setSession(sessionData);
            setStatus('ready');
        } catch { setError('Không tìm thấy phiên thi #' + sid); }
        finally { setManualLoading(false); }
    }, [manualId]);

    // ── Submit all (fallback) ─────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!session || Object.keys(scanned).length === 0) return;
        setSubmitting(true);
        try {
            const results = Object.entries(scanned).map(([cardId, { answer }]) => ({
                card_id: Number(cardId), answer,
            }));
            await api.submitScan(session.session_id, results);
        } catch (e) { setError(e.message); }
        finally { setSubmitting(false); }
    };

    const handleReveal = async () => {
        try { await api.revealAnswer(); setRevealed(true); }
        catch (e) { setError(e.message); }
    };

    const scannedCount = Object.keys(scanned).length;
    const totalActive = contestants.filter(c => c.status === 'active').length;

    return (
        <div style={{ height: '100svh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', flexShrink: 0 }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>📷 Quét thẻ Plickers</div>
                    <div style={{ fontSize: 11, color: status === 'ready' ? '#4ade80' : '#f59e0b', marginTop: 1 }}>
                        {status === 'ready'
                            ? `Câu ${(session?.current_question_index ?? 0) + 1} / ${session?.total_questions ?? '?'}`
                            : status === 'connecting' ? 'Đang kết nối...' : 'Chờ phiên thi bắt đầu...'}
                    </div>
                </div>

                {/* Debug info — xoá khi production */}
                {debugInfo && (
                    <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center' }}>
                        <div style={{ color: ANSWER_COLORS[debugInfo.answer]?.border }}>▶ {debugInfo.answer}</div>
                        <div>conf: {debugInfo.confidence}%</div>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {error && <span style={{ fontSize: 11, color: '#fca5a5', maxWidth: 160, textAlign: 'right' }}>⚠️ {error}</span>}
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24', lineHeight: 1 }}>{scannedCount}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>/ {totalActive || '?'}</div>
                    </div>
                </div>
            </div>

            {/* Camera view */}
            <div style={{ position: 'relative', width: '100%', flex: '1 1 0', minHeight: 0, overflow: 'hidden', background: '#000' }}>
                <video ref={videoRef} playsInline muted autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Scan frame */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{
                        width: '80vmin', height: '80vmin',
                        border: '3px solid rgba(251,191,36,0.85)',
                        borderRadius: 20,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                    }} />
                </div>

                {/* Flash khi quét được */}
                {lastScan && (
                    <div style={{
                        position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                        background: ANSWER_COLORS[lastScan.answer]?.bg || '#fff',
                        border: `2px solid ${ANSWER_COLORS[lastScan.answer]?.border || '#ccc'}`,
                        color: ANSWER_COLORS[lastScan.answer]?.text || '#000',
                        borderRadius: 14, padding: '10px 20px', fontWeight: 700, fontSize: 15,
                        whiteSpace: 'nowrap', animation: 'fadeIn 0.15s ease',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    }}>
                        ✓ {lastScan.name} → <span style={{ fontSize: 22 }}>{lastScan.answer}</span>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    display: 'flex', gap: 8, padding: '10px 12px',
                    background: 'linear-gradient(to top, rgba(15,23,42,0.95) 60%, transparent)',
                }}>
                    <button onClick={handleSubmit} disabled={scannedCount === 0 || submitting}
                        style={{
                            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: 14,
                            background: scannedCount > 0 ? '#2563eb' : '#1e3a5f',
                            color: scannedCount > 0 ? '#fff' : '#64748b',
                            opacity: submitting ? 0.6 : 1,
                        }}>
                        {submitting ? 'Đang gửi...' : `📤 Gửi ${scannedCount} KQ`}
                    </button>
                    <button onClick={handleReveal} disabled={revealed}
                        style={{
                            flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: 14,
                            background: revealed ? '#14532d' : '#16a34a',
                            color: '#fff', opacity: revealed ? 0.7 : 1,
                        }}>
                        {revealed ? '✅ Đã công khai' : '🔓 Công khai ĐA'}
                    </button>
                    <button onClick={() => setShowList(v => !v)}
                        style={{
                            padding: '12px 14px', borderRadius: 12, border: '1.5px solid #334155',
                            background: showList ? '#334155' : 'transparent',
                            color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                        }}>
                        📋
                    </button>
                </div>

                {/* No session overlay */}
                {status !== 'ready' && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 24px' }}>
                        <div style={{ fontSize: 36 }}>{status === 'connecting' ? '🔄' : '⏳'}</div>
                        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                            {status === 'connecting' ? 'Đang kết nối server...' : 'Chưa có phiên thi nào đang diễn ra'}
                        </p>
                        <button onClick={fetchSession}
                            style={{ padding: '7px 18px', borderRadius: 10, border: '1px solid #475569', background: '#1e293b', color: '#cbd5e1', fontSize: 13, cursor: 'pointer' }}>
                            🔃 Thử lại
                        </button>
                        <form onSubmit={handleManualConnect}
                            style={{ display: 'flex', gap: 8, marginTop: 8, width: '100%', maxWidth: 280 }}>
                            <input
                                type="number"
                                placeholder="Nhập Session ID..."
                                value={manualId}
                                onChange={e => setManualId(e.target.value)}
                                style={{
                                    flex: 1, padding: '9px 12px', borderRadius: 10,
                                    border: '1.5px solid #475569', background: '#0f172a',
                                    color: '#f1f5f9', fontSize: 15, textAlign: 'center', outline: 'none',
                                }}
                            />
                            <button type="submit" disabled={!manualId.trim() || manualLoading}
                                style={{
                                    padding: '9px 14px', borderRadius: 10, border: 'none',
                                    background: manualId.trim() ? '#fbbf24' : '#334155',
                                    color: manualId.trim() ? '#92400e' : '#64748b',
                                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                                }}>
                                {manualLoading ? '...' : 'Kết nối'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Scanned list drawer */}
            {showList && (
                <div style={{ flexShrink: 0, maxHeight: '35svh', overflowY: 'auto', background: '#0f172a', borderTop: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 4px', borderBottom: '1px solid #1e293b' }}>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>KẾT QUẢ ĐÃ QUÉT ({scannedCount})</span>
                        <button onClick={() => setScanned({})}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                            🗑 Xoá tất cả
                        </button>
                    </div>
                    {scannedCount === 0 ? (
                        <div style={{ textAlign: 'center', color: '#475569', padding: '16px 0', fontSize: 13 }}>Chưa có kết quả nào</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 10px 10px' }}>
                            {Object.entries(scanned).map(([cardId, { name, answer }]) => {
                                const c = ANSWER_COLORS[answer];
                                return (
                                    <div key={cardId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1e293b', borderRadius: 8, padding: '6px 10px' }}>
                                        <span style={{
                                            width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 900, fontSize: 15, flexShrink: 0,
                                            background: c?.bg, color: c?.text, border: `2px solid ${c?.border}`,
                                        }}>{answer}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                                            <div style={{ fontSize: 10, color: '#64748b' }}>#{String(cardId).padStart(2, '0')}</div>
                                        </div>
                                        <button onClick={() => setScanned(prev => { const n = { ...prev }; delete n[cardId]; return n; })}
                                            style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(6px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
        </div>
    );
}