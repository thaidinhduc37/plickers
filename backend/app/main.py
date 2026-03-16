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
except Exception:
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_origins=["*"],  # Allow all origins for mobile testing
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)

# Đăng ký routes - các router đã có prefix riêng
app.include_router(auth.router, tags=["auth"])
app.include_router(banks.router, tags=["banks"])
app.include_router(contests.router, tags=["contests"])
app.include_router(contestants.router, tags=["contestants"])
app.include_router(session.router, tags=["session"])
app.include_router(scan.router, tags=["scan"])
app.include_router(cards.router, tags=["cards"])
app.include_router(websocket.router, tags=["websocket"])
app.include_router(public_api.router, tags=["public"])

# Global exception handler (sau routes để catch tất cả errors)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback_str = traceback.format_exc()
    
    # Log to file
    try:
        with open("error.log", "a") as f:
            f.write(f"\n[ERROR] {request.method} {request.url.path}: {str(exc)}\n{traceback_str}\n")
    except:
        pass
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
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