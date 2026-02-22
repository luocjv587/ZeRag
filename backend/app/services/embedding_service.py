"""
嵌入（向量化）服务
使用 sentence-transformers 本地模型
"""
from typing import List
from sentence_transformers import SentenceTransformer
from app.config import settings
from app.utils.logger import logger

_model: SentenceTransformer = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("Embedding model loaded")
    return _model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """批量向量化文本，返回向量列表"""
    model = get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()


def embed_query(text: str) -> List[float]:
    """单文本向量化（用于查询）"""
    return embed_texts([text])[0]
