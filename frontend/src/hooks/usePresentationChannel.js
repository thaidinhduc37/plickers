/**
 * hooks/usePresentationChannel.js — v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Cải tiến so với v1:
 *  • Heartbeat 2s — sender liên tục ping, phát hiện disconnect ngay
 *  • Auto-reconnect — receiver tự request lại state khi tab mới load
 *  • lastPayloadRef — sender cache payload cuối, gửi ngay khi receiver vừa connect
 *  • queuedRef — nếu channel chưa sẵn sàng, broadcast được queue lại
 *  • RECONNECT message — receiver báo sender khi cửa sổ được focus lại
 */

import { useEffect, useRef, useCallback, useState } from "react";

const CHANNEL_NAME = "shieldpoll_presentation";
const HEARTBEAT_MS = 2000; // sender ping receiver mỗi 2s
const PING_TIMEOUT = 5000; // nếu không pong trong 5s → offline

export function usePresentationChannel(role = "sender") {
  const channelRef = useRef(null);
  const heartbeatRef = useRef(null);
  const pingTimeoutRef = useRef(null);
  const lastPayloadRef = useRef(null); // sender: cache payload cuối để resync
  const queuedRef = useRef([]); // broadcast queue khi channel chưa sẵn sàng

  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

  // ── Flush queue ─────────────────────────────────────────────────────────────
  const flushQueue = useCallback((ch) => {
    while (queuedRef.current.length > 0) {
      const msg = queuedRef.current.shift();
      try {
        ch.postMessage(msg);
      } catch (_) {}
    }
  }, []);

  // ── Init channel ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;
    flushQueue(ch);

    // ── RECEIVER ──────────────────────────────────────────────────────────────
    if (role === "receiver") {
      ch.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === "STATE_UPDATE") {
          setState(payload);
        }
        if (type === "PING" || type === "RECONNECT_ACK") {
          ch.postMessage({ type: "PONG" });
        }
      };

      // Báo cho sender biết receiver vừa load xong → sender sẽ resync state
      ch.postMessage({ type: "RECONNECT" });

      // Khi tab được focus lại (user quay lại tab chiếu), request resync
      const onFocus = () => ch.postMessage({ type: "RECONNECT" });
      window.addEventListener("focus", onFocus);

      return () => {
        window.removeEventListener("focus", onFocus);
        try {
          ch.postMessage({ type: "DISCONNECT" });
        } catch (_) {}
        ch.close();
        channelRef.current = null;
      };
    }

    // ── SENDER ────────────────────────────────────────────────────────────────
    if (role === "sender") {
      ch.onmessage = (e) => {
        const { type } = e.data;

        if (type === "PONG") {
          // Nhận pong → online
          setConnected(true);
          clearTimeout(pingTimeoutRef.current);
          pingTimeoutRef.current = null;
        }

        if (type === "RECONNECT") {
          // Receiver vừa load/reload → báo connected, LiveView sẽ tự push state đúng
          // KHÔNG tự replay lastPayloadRef vì có thể là state cũ từ phiên trước.
          // LiveView.jsx có effect theo dõi presenterConnected → gọi broadcastState().
          setConnected(true);
          try {
            ch.postMessage({ type: "RECONNECT_ACK" });
          } catch (_) {}
        }

        if (type === "DISCONNECT") {
          setConnected(false);
        }
      };

      // Heartbeat: ping mỗi HEARTBEAT_MS, nếu không pong trong PING_TIMEOUT → offline
      heartbeatRef.current = setInterval(() => {
        try {
          ch.postMessage({ type: "PING" });
        } catch (_) {}
        // Nếu chưa nhận pong sau PING_TIMEOUT → đánh dấu offline
        if (!pingTimeoutRef.current) {
          pingTimeoutRef.current = setTimeout(() => {
            setConnected(false);
            pingTimeoutRef.current = null;
          }, PING_TIMEOUT);
        }
      }, HEARTBEAT_MS);

      // Ping ngay lần đầu
      try {
        ch.postMessage({ type: "PING" });
      } catch (_) {}

      return () => {
        clearInterval(heartbeatRef.current);
        clearTimeout(pingTimeoutRef.current);
        try {
          ch.postMessage({ type: "DISCONNECT" });
        } catch (_) {}
        ch.close();
        channelRef.current = null;
      };
    }
  }, [role, flushQueue]);

  // ── broadcast (sender) ──────────────────────────────────────────────────────
  const broadcast = useCallback((payload) => {
    lastPayloadRef.current = payload; // cache để resync khi receiver reconnect
    const msg = { type: "STATE_UPDATE", payload };
    if (channelRef.current) {
      try {
        channelRef.current.postMessage(msg);
      } catch (_) {}
    } else {
      // Channel chưa sẵn sàng — queue lại
      queuedRef.current.push(msg);
    }
  }, []);

  // ── openPresentation (sender) ───────────────────────────────────────────────
  const openPresentation = useCallback(() => {
    const win = window.open(
      "/presentation",
      "shieldpoll_presenter",
      "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
    );
    // Gửi state hiện tại sau khi cửa sổ load xong (~1s)
    // Receiver cũng sẽ tự RECONNECT khi load, đây chỉ là backup
    setTimeout(() => {
      if (lastPayloadRef.current && channelRef.current) {
        try {
          channelRef.current.postMessage({
            type: "STATE_UPDATE",
            payload: lastPayloadRef.current,
          });
        } catch (_) {}
      }
    }, 1000);
    return win;
  }, []);

  return { broadcast, openPresentation, connected, state };
}
