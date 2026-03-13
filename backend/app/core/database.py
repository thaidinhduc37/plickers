"""
Database engine cấu hình cho MySQL (PyMySQL driver).
Đặt DATABASE_URL trong .env theo format:
  mysql+pymysql://user:password@host:3306/dbname
"""
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

if settings.DATABASE_URL.startswith("sqlite"):
    # NullPool cho SQLite: mỗi request tạo connection mới rồi đóng ngay.
    # Tránh pool exhaustion khi nhiều WS connection cùng mở.
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
        echo=False,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,          # Số connection giữ sẵn
        max_overflow=20,       # Thêm tối đa 20 connection khi cần
        pool_pre_ping=True,    # Kiểm tra connection còn sống trước khi dùng
        pool_recycle=1800,     # Recycle connection sau 30 phút (tránh MySQL "gone away")
        echo=False,            # Đặt True để debug SQL queries
    )

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
