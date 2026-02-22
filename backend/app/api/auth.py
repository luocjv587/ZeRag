from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserInfo, ChangePasswordRequest
from app.services.auth_service import authenticate_user, register_user, get_user_by_username, verify_password, hash_password
from app.utils.jwt import create_access_token
from app.middleware.auth import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """用户自助注册（可通过配置 ALLOW_REGISTER=false 关闭）"""
    if not settings.ALLOW_REGISTER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="当前系统已关闭用户注册，请联系管理员",
        )
    if get_user_by_username(db, data.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名已存在，请换一个",
        )
    user = register_user(db, data.username, data.password)
    token = create_access_token({"sub": user.username})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改当前用户密码"""
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="原密码错误")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "密码修改成功"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(current_user: User = Depends(get_current_user)):
    """使用有效 Token 换取新 Token（延长登录有效期）"""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    new_token = create_access_token({"sub": current_user.username})
    return TokenResponse(access_token=new_token)
