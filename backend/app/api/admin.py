"""
管理员 API
- GET  /api/v1/admin/users              列出所有用户
- POST /api/v1/admin/users              创建用户
- PATCH /api/v1/admin/users/{uid}       更新用户（is_admin / is_active / username）
- DELETE /api/v1/admin/users/{uid}      删除用户
- POST /api/v1/admin/users/{uid}/reset-password  重置密码
- GET  /api/v1/admin/stats              平台统计（用户数、数据源数、问答数）
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from pydantic import BaseModel
from typing import Optional

from app.database.connection import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.data_source import DataSource
from app.models.qa_history import QAHistory
from app.services.auth_service import hash_password, get_user_by_username

router = APIRouter(prefix="/api/v1/admin", tags=["管理员"])


# ── Schema ──────────────────────────────────────────────────────────────────

class AdminUserInfo(BaseModel):
    id: int
    username: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False


class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    username: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    new_password: str


class PlatformStats(BaseModel):
    total_users: int
    total_data_sources: int
    total_qa_history: int
    active_users: int


# ── 权限依赖 ─────────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return current_user


# ── 端点 ──────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[AdminUserInfo])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """列出所有用户（仅管理员）"""
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post("/users", response_model=AdminUserInfo, status_code=status.HTTP_201_CREATED)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """创建新用户（仅管理员）"""
    if len(data.username.strip()) < 2:
        raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    if get_user_by_username(db, data.username):
        raise HTTPException(status_code=409, detail="用户名已存在")
    user = User(
        username=data.username.strip(),
        password_hash=hash_password(data.password),
        is_active=True,
        is_admin=data.is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{uid}", response_model=AdminUserInfo)
def update_user(
    uid: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """更新用户信息（仅管理员）"""
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    # 不允许管理员撤销自己的管理员权限
    if uid == current_user.id and data.is_admin is False:
        raise HTTPException(status_code=400, detail="不能撤销自己的管理员权限")
    if data.username is not None:
        new_name = data.username.strip()
        if len(new_name) < 2:
            raise HTTPException(status_code=400, detail="用户名至少 2 个字符")
        existing = get_user_by_username(db, new_name)
        if existing and existing.id != uid:
            raise HTTPException(status_code=409, detail="用户名已被占用")
        user.username = new_name
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{uid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    uid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """删除用户（仅管理员，不能删除自己）"""
    if uid == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.delete(user)
    db.commit()


@router.post("/users/{uid}/reset-password")
def reset_user_password(
    uid: int,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """重置用户密码（仅管理员）"""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "密码已重置"}


@router.get("/stats", response_model=PlatformStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """获取平台统计数据"""
    return PlatformStats(
        total_users=db.query(User).count(),
        total_data_sources=db.query(DataSource).count(),
        total_qa_history=db.query(QAHistory).count(),
        active_users=db.query(User).filter(User.is_active == True).count(),
    )
