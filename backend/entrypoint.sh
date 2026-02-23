#!/bin/bash
set -e

echo "===== ZeRag Backend Starting ====="

# 等待数据库就绪（如果数据库在同一 compose 内，取消注释以下代码）
# echo "Waiting for database..."
# python -c "
# import time, psycopg2, os
# for i in range(30):
#     try:
#         psycopg2.connect(os.environ['DATABASE_URL']); break
#     except Exception:
#         time.sleep(2)
# "

# 运行数据库迁移（如果存在 alembic）
if [ -f "alembic.ini" ]; then
    echo "Running database migrations..."
    alembic upgrade head
fi

echo "Starting uvicorn server..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips='*'
