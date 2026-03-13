"""
Authentication API routes for ShieldPoll.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import timedelta

from app.core.config import settings
from app.core.database import get_db
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    ensure_admin_user,
)
from app.models.models import AdminUser

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    auto_login: bool


class MeResponse(BaseModel):
    username: str
    auto_login: bool


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login endpoint.
    
    If AUTO_LOGIN is True (dev mode):
        - Returns a dev token with auto_login: true
        - No actual credential verification
    
    If AUTO_LOGIN is False (production):
        - Verifies credentials against database
        - Returns JWT token if successful
        - Returns 401 if credentials are invalid
    """
    # Ensure admin user exists
    ensure_admin_user(db)
    
    if settings.AUTO_LOGIN:
        # Dev mode: return a dev token without verification
        access_token = create_access_token(
            data={"sub": settings.ADMIN_USERNAME},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            auto_login=True
        )
    
    # Production mode: verify credentials
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        auto_login=False
    )


@router.get("/me", response_model=MeResponse)
async def get_current_user_info(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Get current authenticated user info.
    
    If AUTO_LOGIN is True:
        - Returns admin user info with auto_login: true
    
    If AUTO_LOGIN is False:
        - Verifies JWT token
        - Returns user info if valid
        - Returns 401 if token is invalid
    """
    if settings.AUTO_LOGIN:
        return MeResponse(
            username=settings.ADMIN_USERNAME,
            auto_login=True
        )
    
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    user = get_current_user(token, db)
    
    return MeResponse(
        username=user.username,
        auto_login=False
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint.
    
    Since we use stateless JWT, this endpoint just returns a success message.
    The client should remove the token from local storage.
    """
    return {"message": "Logged out successfully"}
