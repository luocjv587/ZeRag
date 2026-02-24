import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# 在导入任何使用 huggingface 的模块之前设置镜像源
if settings.HF_ENDPOINT:
    os.environ["HF_ENDPOINT"] = settings.HF_ENDPOINT
    os.environ["HUGGINGFACE_HUB_ENDPOINT"] = settings.HF_ENDPOINT
    # 禁用 hf_transfer 以避免连接问题
    os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
from app.database.connection import engine, SessionLocal
from app.database.pgvector_setup import setup_pgvector
from app.models import *  # noqa: 确保所有模型被注册
from app.database.connection import Base
from app.services.auth_service import init_default_admin
from app.api import auth, data_sources, qa, tools, admin

app = FastAPI(
    title=settings.APP_NAME,
    description="通用 RAG 智能问答平台",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 配置（允许前端访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(data_sources.router)
app.include_router(qa.router)
app.include_router(tools.router)
app.include_router(admin.router)


@app.on_event("startup")
def startup_event():
    """应用启动时初始化"""
    # 初始化 pgvector 扩展
    setup_pgvector()
    # 创建所有表
    Base.metadata.create_all(bind=engine)
    # 初始化预设管理员账号
    db = SessionLocal()
    try:
        init_default_admin(db)
    finally:
        db.close()
    print(f"🚀 {settings.APP_NAME} started")


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
