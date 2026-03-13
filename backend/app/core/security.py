from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.models import AdminUser

bearer_scheme = HTTPBearer()

ALGORITHM = "HS256"

# Tài khoản BTC mặc định
ADMIN_USERNAME = "btc"
# Pre-computed bcrypt hash for "rcv2024"
# Để đổi password: python -c "import bcrypt; print(bcrypt.hashpw(b'new_password', bcrypt.gensalt()).decode())"
ADMIN_PASSWORD_HASH = "$2b$12$pjualdz5ICTbdLiNFqx29e2eRP6oNpn4x7Jkk9bSg05pxW562O3ZS"  # = "rcv2024"


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
        )


def get_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)
) -> AdminUser:
    """Dependency — xác thực JWT cho các endpoint yêu cầu BTC đăng nhập.
    
    Returns AdminUser object instead of str username.
    """
    payload = decode_token(credentials.credentials)
    username: str = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    
    # Query user from database and return AdminUser object
    user = db.query(AdminUser).filter(AdminUser.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user
