"""
嵌入（向量化）服务
使用 sentence-transformers 本地模型（默认 BAAI/bge-m3，1024 维）

优化：
  - embed_query 接入 LRU 缓存，相同查询文本只向量化一次
  - embed_texts 保持批量接口不变（同步数据源时使用，不走缓存）
"""
import os
from typing import List

from sentence_transformers import SentenceTransformer

from app.config import settings
from app.utils.logger import logger

_model: SentenceTransformer = None


def _setup_hf_mirror():
    """配置 Hugging Face 镜像源（国内服务器使用）"""
    if settings.HF_ENDPOINT:
        # 设置 Hugging Face 镜像端点
        os.environ["HF_ENDPOINT"] = settings.HF_ENDPOINT
        # 确保 huggingface_hub 使用镜像源
        os.environ["HUGGINGFACE_HUB_ENDPOINT"] = settings.HF_ENDPOINT
        logger.info(f"Using Hugging Face mirror: {settings.HF_ENDPOINT}")


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _setup_hf_mirror()
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info(
            f"Embedding model loaded: dim={settings.EMBEDDING_DIMENSION}, "
            f"model={settings.EMBEDDING_MODEL}"
        )
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """批量向量化文本，返回向量列表（数据源同步时调用，不走缓存）"""
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()


def embed_query(text: str) -> List[float]:
    """
    单文本向量化（用于用户查询）。
    接入 embedding 缓存：相同查询文本直接返回缓存向量，跳过模型推理。
    """
    from app.services.cache_service import get_cached_embedding, set_cached_embedding

    cached = get_cached_embedding(text)
    if cached is not None:
        logger.debug(f"Embedding cache hit: '{text[:30]}...'")
        return cached

    result = embed_texts([text])[0]
    set_cached_embedding(text, result)
    return result
