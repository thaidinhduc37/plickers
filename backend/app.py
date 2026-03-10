#!/usr/bin/env python3
"""
Khởi động Rung Chuông Vàng Backend.
Chạy: python run.py
"""
import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",   # Lắng nghe trên tất cả interface (cần để LAN truy cập được)
        port=settings.SERVER_PORT,
        reload=True,       # Tắt reload khi deploy production
        log_level="info",
    )