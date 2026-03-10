from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.ws.manager import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/contest/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    """
    Màn hình lớn và app BTC kết nối vào đây để nhận event realtime.

    Cách kết nối:
        ws://192.168.1.100:8000/ws/contest/{session_id}

    Events server gửi xuống:
        - session_started       : Phiên thi bắt đầu
        - question_changed      : Câu hỏi mới
        - answer_received       : Có thẻ mới được quét
        - answer_revealed       : Đáp án đúng được công bố
        - contestants_eliminated: Danh sách người bị loại
        - btc_override          : BTC thay đổi trạng thái thủ công
        - session_ended         : Kết thúc phiên thi
        - ping                  : Keepalive
    """
    await ws_manager.connect(websocket, session_id)

    # Gửi ngay trạng thái hiện tại khi kết nối
    try:
        from app.services.session_service import get_current_results
        current = get_current_results(db, session_id)
        await websocket.send_json({
            "event": "connected",
            "data": {
                "session_id": session_id,
                "connections": ws_manager.get_connection_count(session_id),
                "current_state": current
            }
        })
    except Exception:
        await websocket.send_json({
            "event": "connected",
            "data": {"session_id": session_id, "message": "Chưa có dữ liệu session"}
        })

    try:
        while True:
            # Nhận ping từ client (keepalive)
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text('{"event":"pong","data":{}}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
