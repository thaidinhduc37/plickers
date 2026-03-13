"""
Dependencies for FastAPI routes.
Includes authentication dependencies.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.services.auth_service import get_current_user, ensure_admin_user
from app.models.models import AdminUser

security = HTTPBearer(auto_error=False)


def get_current_user_or_auto(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> AdminUser:
    """
    Dependency that returns current authenticated user.
    
    If AUTO_LOGIN is True (dev mode):
        - Returns a mock admin user without verification
    
    If AUTO_LOGIN is False (production):
        - Verifies JWT token
        - Returns user if valid
        - Raises 401 if token is invalid or missing
    """
    if settings.AUTO_LOGIN:
        # Dev mode: ensure admin exists and return mock user
        ensure_admin_user(db)
        return AdminUser(id=1, username=settings.ADMIN_USERNAME, hashed_password="")
    
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    return get_current_user(token, db)