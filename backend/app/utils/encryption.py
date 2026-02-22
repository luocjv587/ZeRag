"""
数据源密码加密/解密（Fernet 对称加密）
"""
import os
from cryptography.fernet import Fernet
from app.config import settings


def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        # 若未配置，自动生成并提示（开发模式）
        key = Fernet.generate_key().decode()
        print(f"⚠️  ENCRYPTION_KEY not set, using temporary key. Set it in .env!")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_password(plain_password: str) -> str:
    """加密密码，返回密文字符串"""
    f = _get_fernet()
    return f.encrypt(plain_password.encode()).decode()


def decrypt_password(encrypted_password: str) -> str:
    """解密密码，返回明文字符串"""
    f = _get_fernet()
    return f.decrypt(encrypted_password.encode()).decode()
