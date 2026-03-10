from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import traceback

from app.core.database import engine
from app.models import models
from app.api.routes import auth, contests, contestants, session, scan, cards, websocket, public_api, banks
from app.core.config import settings
from sqlalchemy import text, inspect

models.Base.metadata.create_all(bind=engine)

# Auto-migrate: thêm các column mới nếu DB cũ chưa có
def _auto_migrate():
    with engine.connect() as conn:
        inspector = inspect(engine)
        # contests.max_contestants
        cols = [c["name"] for c in inspector.get_columns("contests")]
        if "max_contestants" not in cols:
            conn.execute(text("ALTER TABLE contests ADD COLUMN max_contestants INTEGER"))
            conn.commit()

try:
    _auto_migrate()
except Exception as e:
    print(f"[migrate] warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("RUNG CHUONG VANG API - Server Starting")
    print("=" * 50)
    print(f"Server Address  : {settings.SERVER_LAN_IP}:{settings.SERVER_PORT}")
    print(f"Docs            : http://{settings.SERVER_LAN_IP}:{settings.SERVER_PORT}/docs")
    print(f"WebSocket       : ws://{settings.SERVER_LAN_IP}:{settings.SERVER_PORT}/ws/contest/{{id}}")
    print("=" * 50)
    yield


app = FastAPI(
    title="Rung Chuông Vàng API",
    description="Backend hệ thống thi trắc nghiệm thời gian thực với thẻ QR vật lý",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS MIDDLEWARE — PHẢI first
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://localhost:5173",
        "https://localhost:5174",
        "https://10.10.11.20:5173",
        "https://10.10.11.20:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

# Đăng ký routes
app.include_router(auth.router)
app.include_router(banks.router)
app.include_router(contests.router)
app.include_router(contestants.router)
app.include_router(session.router)
app.include_router(scan.router)
app.include_router(cards.router)
app.include_router(websocket.router)
app.include_router(public_api.router)

# Global exception handler (sau routes để catch tất cả errors)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"❌ ERROR on {request.method} {request.url.path}: {str(exc)}"
    traceback_str = traceback.format_exc()
    
    # Log to console
    print(error_msg)
    print(traceback_str)
    
    # Also log to file
    try:
        with open("error.log", "a") as f:
            f.write(f"\n{error_msg}\n{traceback_str}\n")
    except:
        pass
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal Server Error: {str(exc)}",
            "type": type(exc).__name__
        }
    )


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Rung Chuông Vàng API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "lan_ip": settings.SERVER_LAN_IP,
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}