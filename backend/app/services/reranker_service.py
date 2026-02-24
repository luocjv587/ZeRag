"""
Reranker 重排序服务
使用 Cross-Encoder 模型对召回的候选 chunks 进行精细化打分与排序。
优点：相比向量相似度，cross-encoder 能同时理解 query 与 chunk 的联合语义，精度更高。
默认模型：BAAI/bge-reranker-base（中英文双语，约 280MB，平衡速度与效果）
"""
import os
from typing import List, Dict, Any

from app.config import settings
from app.utils.logger import logger

_reranker = None


def _setup_hf_mirror():
    """配置 Hugging Face 镜像源（国内服务器使用）"""
    if settings.HF_ENDPOINT:
        # 设置 Hugging Face 镜像端点
        os.environ["HF_ENDPOINT"] = settings.HF_ENDPOINT
        # 确保 huggingface_hub 使用镜像源
        os.environ["HUGGINGFACE_HUB_ENDPOINT"] = settings.HF_ENDPOINT
        # 禁用 hf_transfer 以避免连接问题
        os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
        logger.info(f"Using Hugging Face mirror: {settings.HF_ENDPOINT}")


def get_reranker():
    """懒加载 Cross-Encoder 模型（进程级单例）"""
    global _reranker
    if _reranker is None:
        _setup_hf_mirror()
        from sentence_transformers import CrossEncoder
        logger.info(f"Loading reranker model: {settings.RERANKER_MODEL}")
        _reranker = CrossEncoder(settings.RERANKER_MODEL)
        logger.info("Reranker model loaded")
    return _reranker


def rerank(
    query: str,
    chunks: List[Dict[str, Any]],
    top_k: int,
) -> List[Dict[str, Any]]:
    """
    对候选 chunks 进行 Cross-Encoder 重排序。

    流程：
      1. 构造 (query, chunk_text) 配对
      2. cross-encoder 批量打分
      3. 按分数降序取 top_k

    参数：
      query  : 用户原始问题
      chunks : 初步检索结果（向量 + BM25 融合后的候选池）
      top_k  : 最终保留的块数

    返回：
      重排后的 chunks，每条增加 rerank_score 字段
    """
    if not chunks:
        return chunks

    # 候选数少于等于 top_k 时，仍跑 reranker 以获得精确分数
    try:
        reranker = get_reranker()
        pairs = [(query, chunk["chunk_text"]) for chunk in chunks]
        scores = reranker.predict(pairs)

        for chunk, score in zip(chunks, scores):
            chunk["rerank_score"] = float(score)

        reranked = sorted(chunks, key=lambda x: x.get("rerank_score", 0.0), reverse=True)

        top = reranked[:top_k]
        logger.info(
            f"Reranker: {len(chunks)} chunks → top {len(top)}, "
            f"scores={[round(c.get('rerank_score', 0), 3) for c in top]}"
        )
        return top

    except Exception as e:
        logger.error(f"Reranker failed ({e}), falling back to original order")
        return chunks[:top_k]
