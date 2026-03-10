from fastapi import APIRouter, HTTPException
from app.schemas.schemas import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token, ADMIN_USERNAME, ADMIN_PASSWORD_HASH

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    """BTC đăng nhập để lấy JWT token."""
    if req.username != ADMIN_USERNAME or not verify_password(req.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu")
    token = create_access_token({"sub": req.username})
    return TokenResponse(access_token=token)
