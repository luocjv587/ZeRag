import logging
import sys
import os
from logging.handlers import RotatingFileHandler
from app.config import settings

# 日志格式
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# 创建 handlers 列表
handlers = [logging.StreamHandler(sys.stdout)]  # 控制台输出

# 如果配置了日志文件，添加文件日志
if settings.LOG_FILE:
    # 确保日志目录存在
    log_dir = os.path.dirname(settings.LOG_FILE)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)
    
    # 使用 RotatingFileHandler 实现日志轮转
    file_handler = RotatingFileHandler(
        settings.LOG_FILE,
        maxBytes=settings.LOG_MAX_SIZE * 1024 * 1024,  # 转换为字节
        backupCount=settings.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    handlers.append(file_handler)

# 配置日志级别
log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

# 全局 Logger 配置
logging.basicConfig(
    level=log_level,
    format=LOG_FORMAT,
    datefmt=DATE_FORMAT,
    handlers=handlers,
)

logger = logging.getLogger("zerag")
