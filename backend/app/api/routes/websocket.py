from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.database import SessionLocal
from app.ws.manager import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/contest/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Màn hình lớn và app BTC kết nối vào đây để nhận event realtime.

    Cách kết nối:
        ws://192.168.1.100:8000/ws/contest/{session_id}

    FIX: Không dùng Depends(get_db) — WS kết nối dài, giữ DB connection suốt
    vòng đời → pool exhausted. Thay bằng SessionLocal() mở/đóng tức thì.
    """
    await ws_manager.connect(websocket, session_id)

    # Gửi trạng thái hiện tại ngay khi kết nối — mở DB rồi đóng ngay
    try:
        from app.services.session_service import get_current_results
        db = SessionLocal()
        try:
            current = get_current_results(db, session_id)
        finally:
            db.close()
        await websocket.send_json({
            "event": "connected",
            "data": {
                "session_id": session_id,
                "connections": ws_manager.get_connection_count(session_id),
                "current_state": current,
            },
        })
    except Exception:
        try:
            await websocket.send_json({
                "event": "connected",
                "data": {"session_id": session_id, "message": "Chưa có dữ liệu session"},
            })
        except Exception:
            # Client đã đóng kết nối trước khi nhận được gói connected
            ws_manager.disconnect(websocket)
            return

    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text('{"event":"pong","data":{}}')
    except (WebSocketDisconnect, Exception):
        # Bắt mọi exception (RuntimeError khi client drop không graceful, v.v.)
        ws_manager.disconnect(websocket)
