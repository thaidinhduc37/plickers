import json
import asyncio
from typing import Dict, Set
from fastapi import WebSocket
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Quản lý tất cả WebSocket connections.
    Màn hình lớn và app BTC đều kết nối vào đây.
    Hỗ trợ nhiều session cùng lúc (mỗi session = 1 room).
    """

    def __init__(self):
        # session_id -> set of websockets
        self._rooms: Dict[int, Set[WebSocket]] = {}
        # websocket -> session_id (để cleanup khi disconnect)
        self._socket_to_session: Dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, session_id):
        await websocket.accept()
        sid = str(session_id)
        if sid not in self._rooms:
            self._rooms[sid] = set()
        self._rooms[sid].add(websocket)
        self._socket_to_session[websocket] = sid
        logger.info(f"WS connected | session={sid} | total={len(self._rooms[sid])}")

    def disconnect(self, websocket: WebSocket):
        sid = self._socket_to_session.pop(websocket, None)
        if sid and sid in self._rooms:
            self._rooms[sid].discard(websocket)
            if not self._rooms[sid]:
                del self._rooms[sid]
        logger.info(f"WS disconnected | session={sid}")

    async def broadcast(self, session_id, event: str, data: dict):
        """Gửi event tới tất cả clients đang xem session này."""
        sid = str(session_id)
        if sid not in self._rooms:
            return

        payload = json.dumps({"event": event, "data": data}, ensure_ascii=False, default=str)
        dead_sockets = set()

        for ws in self._rooms[sid].copy():
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"WS send failed: {e}")
                dead_sockets.add(ws)

        # Cleanup dead connections
        for ws in dead_sockets:
            self.disconnect(ws)

    async def broadcast_all(self, event: str, data: dict):
        """Broadcast tới tất cả session (dùng cho admin events)."""
        for session_id in list(self._rooms.keys()):
            await self.broadcast(session_id, event, data)

    def get_connection_count(self, session_id) -> int:
        return len(self._rooms.get(str(session_id), set()))


# Singleton — dùng chung toàn app
ws_manager = ConnectionManager()
