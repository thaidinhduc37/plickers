/**
 * src/pages/ScannerPage.jsx — PCARD v8
 * ─────────────────────────────────────────────────────────────────────────────
 * Cải tiến so với v7:
 *  • Overlay canvas: vẽ bounding box màu lên từng thẻ nhận dạng được trong frame
 *  • Camera: thêm focusMode/exposureMode continuous, fallback graceful
 *  • LOCK_MS giảm từ 1500 → 600ms
 *  • STABLE_MIN_VOTES = 1 (khớp detector v8)
 *  • DETECT_INTERVAL_MS adaptive: 80ms khi có kết quả, 120ms khi không
 *  • Debug panel hiện thêm fps + số thẻ trong frame
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PCardDetector } from '../context/pcard_detector.js';
import { api } from '../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────
const ANSWER_COLORS = {
  A: { bg: '#FEE2E2', border: '#F87171', text: '#991B1B', hex: '#F87171' },
  B: { bg: '#DBEAFE', border: '#60A5FA', text: '#1E40AF', hex: '#60A5FA' },
  C: { bg: '#FEF9C3', border: '#FACC15', text: '#92400E', hex: '#FACC15' },
  D: { bg: '#DCFCE7', border: '#4ADE80', text: '#166534', hex: '#4ADE80' },
};

const LOCK_MS             = 600;   // cooldown mỗi thẻ (v7: 1500ms)
const DETECT_INTERVAL_MS  = 80;    // base interval
const DETECT_INTERVAL_IDLE= 140;   // khi không thấy thẻ nào → giảm tải CPU
const STABLE_MIN_VOTES    = 1;     // khớp MIN_VOTES detector v8
const MIN_CARD_ID         = 1;
const MAX_CARD_ID         = 100;

// ─── Camera constraints ───────────────────────────────────────────────────────
const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: 'environment',
    width:  { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    frameRate: { ideal: 30, max: 60 },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScannerPage() {
  const [contestants,    setContestants]    = useState([]);
  const [session,        setSession]        = useState(null);
  const [scanned,        setScanned]        = useState({});
  const [lastScan,       setLastScan]       = useState(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [revealed,       setRevealed]       = useState(false);
  const [error,          setError]          = useState('');
  const [cameraReady,    setCameraReady]    = useState(false);
  const [status,         setStatus]         = useState('connecting');
  const [manualId,       setManualId]       = useState('');
  const [manualLoading,  setManualLoading]  = useState(false);
  const [showList,       setShowList]       = useState(false);
  const [debugInfo,      setDebugInfo]      = useState(null); // { cardId, answer, confidence, inFrame, fps }

  // Refs
  const videoRef        = useRef(null);
  const canvasRef       = useRef(null);   // hidden processing canvas
  const overlayRef      = useRef(null);   // visible overlay canvas
  const animRef         = useRef(null);
  const streamRef       = useRef(null);
  const detectorRef     = useRef(new PCardDetector());
  const lastDetectMsRef = useRef(0);
  const lockedCardsRef  = useRef({});
  const submittingRef   = useRef(new Set());
  const eliminatedIds   = useRef(new Set());
  const fpsCountRef     = useRef({ frames: 0, last: Date.now(), fps: 0 });
  const lastHadResultRef= useRef(false);

  // Sync eliminated contestants
  useEffect(() => {
    eliminatedIds.current = new Set(
      contestants.filter(c => c.status === 'eliminated').map(c => c.card_id)
    );
  }, [contestants]);

  // ── Session polling ─────────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      const data = await api.getActiveSession();
      if (!data?.session_id) { setStatus('no_session'); setSession(null); return; }
      setSession(prev => {
        if (prev && prev.current_question_index !== data.current_question_index) {
          detectorRef.current.clearBuffer();
          lockedCardsRef.current = {};
          submittingRef.current.clear();
          setScanned({});
          setRevealed(false);
        }
        return data;
      });
      if (data?.contest_id)
        api.getContestants(data.contest_id).then(setContestants).catch(()=>{});
      setStatus('ready');
    } catch { setStatus('no_session'); }
  }, []);

  useEffect(() => {
    fetchSession();
    const t = setInterval(fetchSession, 5000);
    return () => clearInterval(t);
  }, [fetchSession]);

  // ── Camera init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            ...CAMERA_CONSTRAINTS,
            video: {
              ...CAMERA_CONSTRAINTS.video,
              advanced: [{ focusMode: 'continuous', exposureMode: 'continuous', whiteBalanceMode: 'continuous' }],
            },
          });
        } catch {
          // Fallback nếu advanced constraints không được hỗ trợ
          stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
        }
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setError('Không thể truy cập camera. Hãy cấp quyền camera.');
      }
    })();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // ── Draw overlay (bounding boxes lên video) ─────────────────────────────────
  const drawOverlay = useCallback((blobRects, videoW, videoH) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    overlay.width  = videoW;
    overlay.height = videoH;
    ctx.clearRect(0, 0, videoW, videoH);

    for (const rect of blobRects) {
      const color = ANSWER_COLORS[rect.answer]?.hex || '#fff';
      const conf  = Math.round(rect.confidence * 100);

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

      // Label nền
      const label   = `#${String(rect.cardId).padStart(3,'0')} ${rect.answer} ${conf}%`;
      const fontSize = Math.max(12, Math.min(18, rect.w * 0.14));
      ctx.font      = `bold ${fontSize}px system-ui,sans-serif`;
      const tw      = ctx.measureText(label).width;
      const th      = fontSize + 4;
      const lx      = rect.x;
      const ly      = rect.y > th + 4 ? rect.y - th - 2 : rect.y + rect.h + 2;

      ctx.fillStyle   = 'rgba(0,0,0,0.72)';
      ctx.fillRect(lx, ly, tw + 8, th);
      ctx.fillStyle   = color;
      ctx.fillText(label, lx + 4, ly + fontSize);
    }
  }, []);

  // ── Main scan loop ──────────────────────────────────────────────────────────
  const scan = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scan);
      return;
    }

    const now      = Date.now();
    const interval = lastHadResultRef.current ? DETECT_INTERVAL_MS : DETECT_INTERVAL_IDLE;

    if (now - lastDetectMsRef.current >= interval) {
      lastDetectMsRef.current = now;

      // FPS counter
      const fps = fpsCountRef.current;
      fps.frames++;
      if (now - fps.last >= 1000) {
        fps.fps   = fps.frames;
        fps.frames = 0;
        fps.last  = now;
      }

      // Process frame
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameResults = detectorRef.current.detect(canvas, ctx);
      const blobRects    = detectorRef.current.getLastBlobRects();

      // Vẽ overlay
      drawOverlay(blobRects, video.videoWidth, video.videoHeight);

      lastHadResultRef.current = frameResults.length > 0;

      // Debug info
      if (frameResults.length > 0) {
        const best = frameResults.reduce((a,b) => b.confidence > a.confidence ? b : a, frameResults[0]);
        setDebugInfo({
          cardId:     best.cardId,
          answer:     best.answer,
          confidence: Math.round(best.confidence * 100),
          inFrame:    frameResults.length,
          fps:        fps.fps,
        });
      } else {
        setDebugInfo(prev => prev ? { ...prev, inFrame: 0, fps: fps.fps } : null);
      }

      // Ghi nhận kết quả ổn định
      if (session) {
        const stable = detectorRef.current.computeStableResults(STABLE_MIN_VOTES);

        for (const [cardId, { answer }] of stable) {
          if (cardId < MIN_CARD_ID || cardId > MAX_CARD_ID) continue;
          if (lockedCardsRef.current[cardId] && now < lockedCardsRef.current[cardId]) continue;
          if (scanned[cardId]) continue;
          const contestant = contestants.find(c => c.card_id === cardId);
          if (!contestant || eliminatedIds.current.has(cardId)) continue;
          if (submittingRef.current.has(cardId)) continue;

          submittingRef.current.add(cardId);
          lockedCardsRef.current[cardId] = now + LOCK_MS;
          detectorRef.current.clearCard(cardId);

          const name = contestant.name || `Thẻ #${String(cardId).padStart(3,'0')}`;
          setScanned(prev => {
            if (prev[cardId]) return prev;
            setLastScan({ cardId, name, answer });
            setTimeout(() => setLastScan(null), 1600);
            return { ...prev, [cardId]: { name, answer, contestantId: contestant.id } };
          });

          api.submitScan(session.session_id, [{ card_id: cardId, answer }])
            .finally(() => submittingRef.current.delete(cardId));
        }
      }
    }

    animRef.current = requestAnimationFrame(scan);
  }, [session, contestants, scanned, drawOverlay]);

  useEffect(() => {
    if (cameraReady) animRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(animRef.current);
  }, [scan, cameraReady]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleManualConnect = useCallback(async (e) => {
    e.preventDefault();
    const sid = parseInt(manualId.trim(), 10);
    if (isNaN(sid)) return;
    setManualLoading(true);
    try {
      const data = await api.getSessionResults(sid);
      if (!data) { setError('Không tìm thấy phiên thi #' + sid); return; }
      const active = await api.getActiveSession().catch(()=>null);
      const sessionData = active || { session_id:sid, current_question_index:0, total_questions:'?', state:'scanning' };
      sessionData.session_id = sid;
      setSession(sessionData);
      setStatus('ready');
    } catch { setError('Không tìm thấy phiên thi #' + sid); }
    finally  { setManualLoading(false); }
  }, [manualId]);

  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const stable = detectorRef.current.computeStableResults(1);
      const merged = { ...scanned };
      for (const [cardId, { answer }] of stable) {
        if (merged[cardId]) continue;
        const c = contestants.find(c => c.card_id === cardId);
        if (!c || eliminatedIds.current.has(cardId)) continue;
        merged[cardId] = { name: c.name || `Thẻ #${String(cardId).padStart(3,'0')}`, answer, contestantId: c.id };
      }
      if (!Object.keys(merged).length) return;
      await api.submitScan(session.session_id,
        Object.entries(merged).map(([cardId, {answer}]) => ({ card_id: Number(cardId), answer }))
      );
      setScanned(merged);
    } catch(e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleReveal = async () => {
    try { await api.revealAnswer(); setRevealed(true); }
    catch(e) { setError(e.message); }
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const scannedCount = Object.keys(scanned).length;
  const totalActive  = contestants.filter(c => c.status === 'active').length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ height:'100svh', background:'#0f172a', color:'#f1f5f9', fontFamily:'system-ui,sans-serif', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Header ── */}
      <div style={{ background:'#1e293b', padding:'8px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #334155', flexShrink:0 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:14 }}>📷 Quét thẻ PCARD (7×7)</div>
          <div style={{ fontSize:11, color: status==='ready' ? '#4ade80' : '#f59e0b', marginTop:1 }}>
            {status==='ready'
              ? `Câu ${(session?.current_question_index ?? 0)+1} / ${session?.total_questions ?? '?'}`
              : status==='connecting' ? 'Đang kết nối...' : 'Chờ phiên thi...'}
          </div>
        </div>

        {/* Debug chip */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {debugInfo && (
            <div style={{ fontSize:10, color:'#64748b', textAlign:'center', lineHeight:1.5 }}>
              <div style={{ color: ANSWER_COLORS[debugInfo.answer]?.hex, fontWeight:700 }}>
                #{String(debugInfo.cardId).padStart(3,'0')} → {debugInfo.answer} {debugInfo.confidence}%
              </div>
              <div>{debugInfo.inFrame > 0 ? `${debugInfo.inFrame} thẻ` : 'không thấy'} · {debugInfo.fps} fps</div>
            </div>
          )}
          {error && (
            <span style={{ fontSize:11, color:'#fca5a5', maxWidth:120, textAlign:'right' }}>⚠️ {error}</span>
          )}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#fbbf24', lineHeight:1 }}>{scannedCount}</div>
            <div style={{ fontSize:10, color:'#64748b' }}>/ {totalActive || '?'}</div>
          </div>
        </div>
      </div>

      {/* ── Camera view ── */}
      <div style={{ position:'relative', width:'100%', flex:'1 1 0', minHeight:0, overflow:'hidden', background:'#000' }}>

        <video ref={videoRef} playsInline muted autoPlay
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />

        {/* Hidden processing canvas */}
        <canvas ref={canvasRef} style={{ display:'none' }} />

        {/* Overlay canvas — vẽ bounding box */}
        <canvas ref={overlayRef} style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          pointerEvents:'none',
          objectFit:'cover',
        }} />

        {/* Viền hướng dẫn (không còn restrict ROI, chỉ visual guide) */}
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          pointerEvents:'none',
        }}>
          <div style={{
            width:'88vmin', height:'88vmin',
            border:'2px dashed rgba(251,191,36,0.4)',
            borderRadius:16,
          }} />
        </div>

        {/* Toast thẻ vừa quét */}
        {lastScan && (
          <div style={{
            position:'absolute', bottom:88, left:'50%', transform:'translateX(-50%)',
            background: ANSWER_COLORS[lastScan.answer]?.bg || '#fff',
            border: `2px solid ${ANSWER_COLORS[lastScan.answer]?.border || '#ccc'}`,
            color: ANSWER_COLORS[lastScan.answer]?.text || '#000',
            borderRadius:14, padding:'10px 20px', fontWeight:700, fontSize:15,
            whiteSpace:'nowrap', animation:'fadeInUp 0.15s ease',
            boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
          }}>
            ✓ {lastScan.name} → <span style={{ fontSize:22 }}>{lastScan.answer}</span>
          </div>
        )}

        {/* Action bar */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          display:'flex', gap:8, padding:'10px 12px',
          background:'linear-gradient(to top, rgba(15,23,42,0.95) 60%, transparent)',
        }}>
          <button onClick={handleSubmit} disabled={scannedCount===0 || submitting}
            style={{
              flex:1, padding:'12px 0', borderRadius:12, border:'none', cursor:'pointer',
              fontWeight:700, fontSize:14,
              background: scannedCount>0 ? '#2563eb' : '#1e3a5f',
              color: scannedCount>0 ? '#fff' : '#64748b',
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting ? 'Đang gửi...' : `📤 Gửi ${scannedCount} KQ`}
          </button>

          <button onClick={handleReveal} disabled={revealed}
            style={{
              flex:1, padding:'12px 0', borderRadius:12, border:'none', cursor:'pointer',
              fontWeight:700, fontSize:14,
              background: revealed ? '#14532d' : '#16a34a',
              color:'#fff', opacity: revealed ? 0.7 : 1,
            }}>
            {revealed ? '✅ Đã công khai' : '🔓 Công khai ĐA'}
          </button>

          <button onClick={() => setShowList(v => !v)}
            style={{
              padding:'12px 14px', borderRadius:12, border:'1.5px solid #334155',
              background: showList ? '#334155' : 'transparent',
              color:'#94a3b8', cursor:'pointer', fontSize:18, lineHeight:1,
            }}>
            📋
          </button>
        </div>

        {/* Overlay no-session */}
        {status !== 'ready' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:'0 24px' }}>
            <div style={{ fontSize:36 }}>{status==='connecting' ? '🔄' : '⏳'}</div>
            <p style={{ color:'#94a3b8', fontSize:14, textAlign:'center' }}>
              {status==='connecting' ? 'Đang kết nối server...' : 'Chưa có phiên thi nào đang diễn ra'}
            </p>
            <button onClick={fetchSession}
              style={{ padding:'7px 18px', borderRadius:10, border:'1px solid #475569', background:'#1e293b', color:'#cbd5e1', fontSize:13, cursor:'pointer' }}>
              🔃 Thử lại
            </button>
            <form onSubmit={handleManualConnect}
              style={{ display:'flex', gap:8, marginTop:8, width:'100%', maxWidth:280 }}>
              <input
                type="number" placeholder="Nhập Session ID..."
                value={manualId} onChange={e => setManualId(e.target.value)}
                style={{
                  flex:1, padding:'9px 12px', borderRadius:10,
                  border:'1.5px solid #475569', background:'#0f172a',
                  color:'#f1f5f9', fontSize:15, textAlign:'center', outline:'none',
                }}
              />
              <button type="submit" disabled={!manualId.trim() || manualLoading}
                style={{
                  padding:'9px 14px', borderRadius:10, border:'none',
                  background: manualId.trim() ? '#fbbf24' : '#334155',
                  color: manualId.trim() ? '#92400e' : '#64748b',
                  fontWeight:700, fontSize:14, cursor:'pointer',
                }}>
                {manualLoading ? '...' : 'Kết nối'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Scanned list ── */}
      {showList && (
        <div style={{ flexShrink:0, maxHeight:'35svh', overflowY:'auto', background:'#0f172a', borderTop:'1px solid #334155' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px 4px', borderBottom:'1px solid #1e293b' }}>
            <span style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>KẾT QUẢ ĐÃ QUÉT ({scannedCount})</span>
            <button onClick={() => setScanned({})}
              style={{ background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:12 }}>
              🗑 Xoá tất cả
            </button>
          </div>
          {scannedCount === 0 ? (
            <div style={{ textAlign:'center', color:'#475569', padding:'16px 0', fontSize:13 }}>Chưa có kết quả nào</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:4, padding:'6px 10px 10px' }}>
              {Object.entries(scanned).map(([cardId, { name, answer }]) => {
                const c = ANSWER_COLORS[answer];
                return (
                  <div key={cardId} style={{ display:'flex', alignItems:'center', gap:8, background:'#1e293b', borderRadius:8, padding:'6px 10px' }}>
                    <span style={{
                      width:30, height:30, borderRadius:'50%',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontWeight:900, fontSize:15, flexShrink:0,
                      background:c?.bg, color:c?.text, border:`2px solid ${c?.border}`,
                    }}>{answer}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
                      <div style={{ fontSize:10, color:'#64748b' }}>#{String(cardId).padStart(3,'0')}</div>
                    </div>
                    <button
                      onClick={() => setScanned(prev => { const n={...prev}; delete n[cardId]; return n; })}
                      style={{ background:'transparent', border:'none', color:'#475569', cursor:'pointer', fontSize:16, padding:2 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateX(-50%) translateY(8px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}