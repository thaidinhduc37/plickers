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

const LOCK_MS             = 300;   // cooldown mỗi thẻ — lia nhanh cần unlock sớm

// FIX #15: Limit scan rate to 10 FPS to prevent CPU spike with 100+ cards
// 30 FPS → 100 cards = CPU spike, 10 FPS is sufficient for scanning
const MAX_SCAN_FPS = 15;
const SCAN_INTERVAL_MS = 1000 / MAX_SCAN_FPS; // ~67ms per frame

// Scale video xuống 960px trước khi detect(). Ở 960px, binarize() chạy S=1
// (floor(960/960)=1), ~520K phép/frame — chấp nhận được ở 10 FPS.
// 960px cho phép bắt thẻ nhỏ/xa tốt hơn nhiều so với 640px.
const DETECT_W            = 960;

const DETECT_INTERVAL_MS  = SCAN_INTERVAL_MS;    // base interval (10 FPS)
// Bỏ idle slowdown — lia camera cần luôn quét ở tốc độ tối đa
// Khi lia, thẻ xuất hiện rồi biến mất rất nhanh, giảm FPS = bỏ sót
const DETECT_INTERVAL_IDLE= SCAN_INTERVAL_MS;
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
  // Bug C fix: scannedRef mirrors scanned state so scan loop doesn't need scanned in deps
  const scannedRef      = useRef({});

  // Bug C fix: keep scannedRef in sync with state so scan loop reads latest without being in deps
  useEffect(() => { scannedRef.current = scanned; }, [scanned]);

  // Sync eliminated contestants
  useEffect(() => {
    eliminatedIds.current = new Set(
      contestants.filter(c => c.status === 'eliminated').map(c => c.card_id)
    );
  }, [contestants]);

  // ── Session polling ─────────────────────────────────────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      // Dùng API có auth — giống bản gốc
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
      if (data?.contest_id) {
        const res = await api.getContestants(data.contest_id);
        setContestants(res || []);
      }
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
          try {
            // Fallback 1: bỏ advanced constraints (focusMode không được hỗ trợ)
            stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
          } catch {
            // Fallback 2: bỏ min constraints (phone không đảm bảo 1280px)
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
            });
          }
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
  /**
   * FIX #15: Scan loop limited to 10 FPS to prevent CPU spike
   * FIX #6: Report detection count for UI feedback
   */
  const scan = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scan);
      return;
    }

    const now      = Date.now();
    const interval = lastHadResultRef.current ? DETECT_INTERVAL_MS : DETECT_INTERVAL_IDLE;

    // FIX #15: Enforce 10 FPS limit
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

      // PERF FIX: Draw video scaled to DETECT_W before detect() so binarize()
      // runs with S=1 (no inner downsample loop) — ~9× faster on mobile
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const vW = video.videoWidth || 1280;
      const vH = video.videoHeight || 720;
      const scale  = DETECT_W / vW;
      canvas.width  = DETECT_W;
      canvas.height = Math.round(vH * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameResults = detectorRef.current.detect(canvas, ctx);
      const blobRects    = detectorRef.current.getLastBlobRects();

      // Scale blobRects back to video coordinates for overlay
      const invScale = 1 / scale;
      const scaledRects = blobRects.map(r => ({
        ...r,
        x: r.x * invScale, y: r.y * invScale,
        w: r.w * invScale, h: r.h * invScale,
      }));

      // Vẽ overlay
      drawOverlay(scaledRects, vW, vH);

      lastHadResultRef.current = frameResults.length > 0;

      // FIX #6: Get detection count for UI feedback
      const detectionStats = detectorRef.current.getDetectionStats();
      const detectedCardIds = detectorRef.current.getDetectedCardIds();

      // Debug info
      if (frameResults.length > 0) {
        const best = frameResults.reduce((a,b) => b.confidence > a.confidence ? b : a, frameResults[0]);
        setDebugInfo({
          cardId:     best.cardId,
          answer:     best.answer,
          confidence: Math.round(best.confidence * 100),
          inFrame:    frameResults.length,
          detected:   detectionStats.detected,
          fps:        fps.fps,
        });
      } else {
        setDebugInfo(prev => prev ? { ...prev, inFrame: 0, detected: 0, fps: fps.fps } : null);
      }

      // 2-frame confirm: detect() feed buffer, computeStableResults lọc 2 frame đồng ý
      if (session) {
        // DIAGNOSTIC LOG: Log session state before attempting submit
        if (session.state !== 'scanning') {
          console.warn(
            `[DIAGNOSTIC] ScannerPage: session.state = "${session.state}", expected "scanning". ` +
            `Session: ${JSON.stringify({ session_id: session.session_id, state: session.state, current_question_index: session.current_question_index })}`
          );
        }
        const stable = detectorRef.current.computeStableResults(STABLE_MIN_VOTES);
        const batch = [];

        for (const [cardId, { answer }] of stable) {
          if (cardId < MIN_CARD_ID || cardId > MAX_CARD_ID) continue;
          if (scannedRef.current[cardId]) continue;
          if (lockedCardsRef.current[cardId] && now < lockedCardsRef.current[cardId]) continue;
          const contestant = contestants.find(c => c.card_id === cardId);
          if (!contestant || eliminatedIds.current.has(cardId)) continue;
          if (submittingRef.current.has(cardId)) continue;

          submittingRef.current.add(cardId);
          lockedCardsRef.current[cardId] = now + LOCK_MS;
          detectorRef.current.clearCard(cardId);

          const name = contestant.name || `Thẻ #${String(cardId).padStart(3,'0')}`;
          batch.push({ card_id: cardId, answer, name, contestantId: contestant.id });

          setScanned(prev => {
            if (prev[cardId]) return prev;
            return { ...prev, [cardId]: { name, answer, contestantId: contestant.id } };
          });
        }

        if (batch.length > 0) {
          const last = batch[batch.length - 1];
          setLastScan({ cardId: last.card_id, name: last.name, answer: last.answer });
          setTimeout(() => setLastScan(null), 1600);

          api.submitScan(session.session_id,
            batch.map(({ card_id, answer }) => ({ card_id, answer }))
          ).finally(() => {
            for (const item of batch) submittingRef.current.delete(item.card_id);
          });
        }
      }
    }

    animRef.current = requestAnimationFrame(scan);
  }, [session, contestants, drawOverlay]);

  useEffect(() => {
    if (cameraReady) animRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(animRef.current);
  }, [scan, cameraReady]);

  // ── Handlers ────────────────────────────────────────────────────────────────
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
      // Bug B fix: dùng auth endpoint giống scan loop — có ownership check
      await api.submitScan(session.session_id,
        Object.entries(merged).map(([cardId, {answer}]) => ({ card_id: Number(cardId), answer }))
      );
      setScanned(merged);
    } catch(e) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleReveal = async () => {
    // Bug H fix: dùng auth endpoint — ScannerPage là ProtectedRoute, public endpoint không có ownership check
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

        {/* Overlay no-session: tự động kết nối qua auth, không cần nhập ID thủ công */}
        {status !== 'ready' && (
          <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,0.92)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'0 32px' }}>
            <div style={{ fontSize:40 }}>{status==='connecting' ? '🔄' : '⏳'}</div>
            <p style={{ color:'#e2e8f0', fontSize:16, fontWeight:600, textAlign:'center', margin:0 }}>
              {status==='connecting' ? 'Đang kết nối...' : 'Chưa có phiên thi nào đang diễn ra'}
            </p>
            <p style={{ color:'#64748b', fontSize:13, textAlign:'center', margin:0 }}>
              {status==='connecting'
                ? 'Đang tìm phiên thi hiện tại...'
                : 'Hãy bắt đầu phiên thi từ trang Dashboard, trang này sẽ tự động kết nối.'}
            </p>
            <button onClick={fetchSession}
              style={{ padding:'9px 22px', borderRadius:10, border:'1px solid #475569', background:'#1e293b', color:'#cbd5e1', fontSize:14, cursor:'pointer', marginTop:4 }}>
              🔃 Kiểm tra lại
            </button>
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
