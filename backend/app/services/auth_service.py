"""
Authentication service for ShieldPoll.
Handles password hashing, JWT token creation/verification, and user authentication.
"""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.models import AdminUser

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

import hashlib

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    Supports both raw bcrypt and SHA-256 pre-hashed bcrypt for compatibility.
    """
    if not plain_password:
        return False

    # 1. Thử xác thực với SHA-256 pre-hash (chuẩn mới - hỗ trợ độ dài vô hạn)
    pre_hashed = hashlib.sha256(plain_password.encode()).hexdigest()
    try:
        if pwd_context.verify(pre_hashed, hashed_password):
            return True
    except Exception:
        pass
        
    # 2. Thử xác thực trực tiếp (chuẩn cũ - tương thích ngược)
    # CHỈ thử nếu mật khẩu không vượt quá giới hạn 72 bytes của bcrypt
    try:
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) <= 72:
            return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        pass
        
    return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using SHA-256 pre-hash + bcrypt.
    This bypasses bcrypt's 72-byte limit.
    """
    pre_hashed = hashlib.sha256(password.encode()).hexdigest()
    return pwd_context.hash(pre_hashed)


def authenticate_user(db: Session, username: str, password: str) -> Optional[AdminUser]:
    """
    Authenticate user by username and password.
    Returns AdminUser if successful, None otherwise.
    """
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT access token and return the payload."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(token: str, db: Session) -> AdminUser:
    """
    Get current authenticated user from JWT token.
    Raises HTTPException if token is invalid or user not found.
    """
    if settings.AUTO_LOGIN:
        # Dev mode: return a mock admin user
        return AdminUser(id=1, username="Admin", hashed_password="")
    
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


def update_password(db: Session, user: AdminUser, old_password: str, new_password: str) -> bool:
    """
    Update user password.
    Returns True if successful, False if old password is incorrect.
    """
    if not verify_password(old_password, user.hashed_password):
        return False
    
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(user)
    return True


def ensure_admin_user(db: Session) -> AdminUser:
    """
    Ensure admin user exists in database.
    Creates admin user with default credentials if not exists.
    """
    admin = db.query(AdminUser).filter(AdminUser.username == settings.ADMIN_USERNAME).first()
    if admin:
        return admin
    
    # Create admin user with hashed password
    hashed_password = get_password_hash(settings.ADMIN_PASSWORD)
    admin = AdminUser(
        username=settings.ADMIN_USERNAME,
        hashed_password=hashed_password
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin