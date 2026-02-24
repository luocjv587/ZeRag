"""
缓存服务

两级缓存：
  1. Embedding 缓存（LRU）
     - 相同文本 → 相同向量，永远不会变化，用 LRU 淘汰冷数据即可
     - 默认最多缓存 2000 条查询向量（约 2000 × 384 × 4B ≈ 3MB，可接受）

  2. RAG 结果缓存（TTL）
     - 相同问题 + 相同数据源 → 结果大概率相同（数据源没有更新时）
     - 使用 TTL 自动过期（默认 5 分钟）
     - 数据源重新同步时，通过版本号机制立即使旧缓存失效

版本号机制：
  每个 data_source_id 维护一个版本计数器，数据源 sync 时 bump +1。
  结果缓存的 key 包含版本号，版本变化后旧 key 自动不命中（TTL 自然过期）。
"""
from __future__ import annotations

import hashlib
from threading import Lock
from typing import Any, Dict, Optional

from app.config import settings
from app.utils.logger import logger

# ─────────────────────────────────────────────────────────────
# Embedding 缓存（LRU，无过期时间）
# ─────────────────────────────────────────────────────────────

_embedding_cache: Dict[str, list] = {}
_embedding_order: list = []          # 维护 LRU 顺序
_embedding_lock = Lock()


def _embed_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def get_cached_embedding(text: str) -> Optional[list]:
    if not settings.ENABLE_EMBEDDING_CACHE:
        return None
    key = _embed_key(text)
    with _embedding_lock:
        if key in _embedding_cache:
            # LRU：移到末尾
            try:
                _embedding_order.remove(key)
            except ValueError:
                pass
            _embedding_order.append(key)
            return _embedding_cache[key]
    return None


def set_cached_embedding(text: str, embedding: list) -> None:
    if not settings.ENABLE_EMBEDDING_CACHE:
        return
    key = _embed_key(text)
    with _embedding_lock:
        if key not in _embedding_cache:
            # 超容量时淘汰最久未使用的条目
            while len(_embedding_cache) >= settings.EMBEDDING_CACHE_SIZE:
                oldest = _embedding_order.pop(0)
                _embedding_cache.pop(oldest, None)
            _embedding_order.append(key)
        else:
            try:
                _embedding_order.remove(key)
            except ValueError:
                pass
            _embedding_order.append(key)
        _embedding_cache[key] = embedding


# ─────────────────────────────────────────────────────────────
# 数据源版本号（用于结果缓存失效）
# ─────────────────────────────────────────────────────────────

_ds_versions: Dict[int, int] = {}
_version_lock = Lock()


def _get_ds_version(data_source_id: Optional[int]) -> int:
    if data_source_id is None:
        return 0
    with _version_lock:
        return _ds_versions.get(data_source_id, 0)


def bump_ds_version(data_source_id: int) -> None:
    """数据源重新同步后调用，使所有相关结果缓存失效"""
    with _version_lock:
        _ds_versions[data_source_id] = _ds_versions.get(data_source_id, 0) + 1
    logger.info(f"Cache: datasource {data_source_id} version bumped → {_ds_versions[data_source_id]}")


# ─────────────────────────────────────────────────────────────
# RAG 结果缓存（TTL，基于 cachetools）
# ─────────────────────────────────────────────────────────────

_result_cache: Optional[Any] = None   # TTLCache，延迟初始化
_result_lock = Lock()


def _get_result_cache():
    global _result_cache
    if _result_cache is None:
        try:
            from cachetools import TTLCache
            _result_cache = TTLCache(
                maxsize=settings.RESULT_CACHE_SIZE,
                ttl=settings.RESULT_CACHE_TTL,
            )
        except ImportError:
            logger.warning("cachetools not installed, result cache disabled")
            _result_cache = {}   # 退化为不过期字典（仍能工作，只是没 TTL）
    return _result_cache


def _result_key(question: str, data_source_id: Optional[int], top_k: int) -> str:
    version = _get_ds_version(data_source_id)
    raw = f"{question}|{data_source_id}|{top_k}|v{version}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached_result(
    question: str,
    data_source_id: Optional[int],
    top_k: int,
) -> Optional[dict]:
    if not settings.ENABLE_RESULT_CACHE:
        return None
    key = _result_key(question, data_source_id, top_k)
    cache = _get_result_cache()
    with _result_lock:
        return cache.get(key)


def set_cached_result(
    question: str,
    data_source_id: Optional[int],
    top_k: int,
    result: dict,
) -> None:
    if not settings.ENABLE_RESULT_CACHE:
        return
    key = _result_key(question, data_source_id, top_k)
    cache = _get_result_cache()
    with _result_lock:
        try:
            cache[key] = result
        except Exception:
            pass  # TTLCache 满时会自动淘汰，不应抛出异常，但防御一下
