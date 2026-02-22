"""
文本分块工具
支持多种分块策略：
  - fixed      : 固定字符数 + 重叠窗口（默认，适合数据库行文本）
  - paragraph  : 按段落分块（以 \\n\\n 为分隔，适合结构化文档）
  - sentence   : 按句子分块（以句号/问号/感叹号为分隔，适合叙述性文本）
  - smart      : 智能分块（先按段落，段落过长再按句子，最终 fallback 到 fixed）
"""
import re
from typing import List

# 支持的策略名称
CHUNK_STRATEGIES = ("fixed", "paragraph", "sentence", "smart")


# ─────────────────────────────────────────────────────────────
# 基础：固定字符数分块
# ─────────────────────────────────────────────────────────────

def split_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    固定字符数分块（中文场景下 1 字符 ≈ 1 token）
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


# ─────────────────────────────────────────────────────────────
# 段落分块
# ─────────────────────────────────────────────────────────────

def split_text_by_paragraph(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    按段落分块：以连续空行（\\n\\n 或 \\r\\n\\r\\n）为段落边界。
    若段落超过 chunk_size，则继续用 split_text 切分。
    短段落会被合并，直到接近 chunk_size。
    """
    if not text or not text.strip():
        return []

    # 规范化换行
    text = text.replace('\r\n', '\n').strip()
    raw_paragraphs = re.split(r'\n{2,}', text)
    paragraphs = [p.strip() for p in raw_paragraphs if p.strip()]

    if not paragraphs:
        return split_text(text, chunk_size, chunk_overlap)

    chunks: List[str] = []
    buffer = ""

    for para in paragraphs:
        # 超长段落直接用 fixed 切
        if len(para) > chunk_size:
            if buffer:
                chunks.append(buffer.strip())
                buffer = ""
            chunks.extend(split_text(para, chunk_size, chunk_overlap))
            continue

        # 合并到 buffer
        candidate = (buffer + "\n\n" + para).strip() if buffer else para
        if len(candidate) <= chunk_size:
            buffer = candidate
        else:
            if buffer:
                chunks.append(buffer.strip())
            buffer = para

    if buffer:
        chunks.append(buffer.strip())

    return [c for c in chunks if c]


# ─────────────────────────────────────────────────────────────
# 句子分块
# ─────────────────────────────────────────────────────────────

# 中英文句子结束符
_SENTENCE_END = re.compile(r'(?<=[。！？.!?])\s*')


def split_text_by_sentence(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    按句子分块：以中英文句尾标点为分隔，合并短句直到接近 chunk_size。
    """
    if not text or not text.strip():
        return []

    text = text.strip()
    sentences = [s.strip() for s in _SENTENCE_END.split(text) if s.strip()]

    if not sentences:
        return split_text(text, chunk_size, chunk_overlap)

    chunks: List[str] = []
    buffer = ""

    for sent in sentences:
        # 超长句子用 fixed 切
        if len(sent) > chunk_size:
            if buffer:
                chunks.append(buffer.strip())
                buffer = ""
            chunks.extend(split_text(sent, chunk_size, chunk_overlap))
            continue

        candidate = (buffer + sent) if buffer else sent
        if len(candidate) <= chunk_size:
            buffer = candidate
        else:
            if buffer:
                chunks.append(buffer.strip())
            buffer = sent

    if buffer:
        chunks.append(buffer.strip())

    # 重叠处理：在每个 chunk 末尾追加下一 chunk 的前 chunk_overlap 个字符
    if chunk_overlap > 0 and len(chunks) > 1:
        overlapped = []
        for i, chunk in enumerate(chunks):
            if i < len(chunks) - 1:
                overlap_text = chunks[i + 1][:chunk_overlap]
                overlapped.append(chunk + overlap_text)
            else:
                overlapped.append(chunk)
        return overlapped

    return [c for c in chunks if c]


# ─────────────────────────────────────────────────────────────
# 智能分块（自动选择）
# ─────────────────────────────────────────────────────────────

def split_text_smart(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    智能分块：
    - 若文本含多个段落（\\n\\n） → 段落分块
    - 若文本含多个句子 → 句子分块
    - 否则 → 固定字符数分块
    """
    if not text or not text.strip():
        return []

    text_stripped = text.strip()

    # 检测是否有明显的段落结构
    paragraph_count = len(re.split(r'\n{2,}', text_stripped))
    if paragraph_count >= 3:
        return split_text_by_paragraph(text_stripped, chunk_size, chunk_overlap)

    # 检测是否有多个句子
    sentences = [s for s in _SENTENCE_END.split(text_stripped) if s.strip()]
    if len(sentences) >= 5:
        return split_text_by_sentence(text_stripped, chunk_size, chunk_overlap)

    # fallback 到固定分块
    return split_text(text_stripped, chunk_size, chunk_overlap)


# ─────────────────────────────────────────────────────────────
# 统一分发入口
# ─────────────────────────────────────────────────────────────

def split_text_by_strategy(
    text: str,
    strategy: str = "smart",
    chunk_size: int = 512,
    chunk_overlap: int = 64,
) -> List[str]:
    """
    按指定策略分块：
      strategy: "fixed" | "paragraph" | "sentence" | "smart"
    """
    if strategy == "paragraph":
        return split_text_by_paragraph(text, chunk_size, chunk_overlap)
    elif strategy == "sentence":
        return split_text_by_sentence(text, chunk_size, chunk_overlap)
    elif strategy == "smart":
        return split_text_smart(text, chunk_size, chunk_overlap)
    else:  # "fixed" or unknown
        return split_text(text, chunk_size, chunk_overlap)


# ─────────────────────────────────────────────────────────────
# 工具函数
# ─────────────────────────────────────────────────────────────

def row_to_text(table_name: str, row: dict) -> str:
    """
    将数据库行记录转为自然语言描述文本，供嵌入模型处理
    例：表 users 中的记录 id=1, name=张三, email=zs@example.com
    """
    fields = "，".join([f"{k}={v}" for k, v in row.items() if v is not None])
    return f"表 {table_name} 中的记录：{fields}"
