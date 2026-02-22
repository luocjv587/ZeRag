from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.models.user import User
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def register_user(db: Session, username: str, password: str) -> User:
    """注册普通用户（非管理员）。调用前应校验用户名是否已存在。"""
    user = User(
        username=username,
        password_hash=hash_password(password),
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def init_default_admin(db: Session) -> None:
    """初始化预设管理员账号（启动时调用）"""
    existing = get_user_by_username(db, settings.DEFAULT_ADMIN_USERNAME)
    if not existing:
        admin = User(
            username=settings.DEFAULT_ADMIN_USERNAME,
            password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
            is_active=True,
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        print(f"✅ Default admin created: {settings.DEFAULT_ADMIN_USERNAME}")
    else:
        # 确保 admin 账号始终拥有管理员权限
        if not existing.is_admin:
            existing.is_admin = True
            db.commit()
