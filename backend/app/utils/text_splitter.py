"""
文本分块工具
将长文本按 token 数量切分，并支持重叠窗口
"""
from typing import List


def split_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    简单按字符数分块（中文场景下 1 字符 ≈ 1 token）
    chunk_size: 每块最大字符数
    chunk_overlap: 相邻块重叠字符数
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - chunk_overlap

    return chunks


def row_to_text(table_name: str, row: dict) -> str:
    """
    将数据库行记录转为自然语言描述文本，供嵌入模型处理
    例：表 users 中的记录 id=1, name=张三, email=zs@example.com
    """
    fields = "，".join([f"{k}={v}" for k, v in row.items() if v is not None])
    return f"表 {table_name} 中的记录：{fields}"
