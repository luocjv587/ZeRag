"""
文件内容提取服务
支持：PDF、Word (.docx)、PowerPoint (.pptx)、纯文本 (.txt)
"""
import os
from typing import List
from app.utils.logger import logger


def extract_text_from_pdf(file_path: str) -> str:
    """使用 pdfplumber 提取 PDF 文本"""
    try:
        import pdfplumber
        texts = []
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                text = page.extract_text()
                if text and text.strip():
                    texts.append(f"[第{page_num}页]\n{text.strip()}")
        return "\n\n".join(texts)
    except ImportError:
        raise ImportError("pdfplumber 未安装，请运行: pip install pdfplumber")
    except Exception as e:
        logger.error(f"PDF 解析失败 {file_path}: {e}")
        raise


def extract_text_from_docx(file_path: str) -> str:
    """使用 python-docx 提取 Word 文本"""
    try:
        from docx import Document
        doc = Document(file_path)
        texts = []
        for para in doc.paragraphs:
            if para.text.strip():
                texts.append(para.text.strip())
        # 提取表格内容
        for table in doc.tables:
            for row in table.rows:
                row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_texts:
                    texts.append(" | ".join(row_texts))
        return "\n".join(texts)
    except ImportError:
        raise ImportError("python-docx 未安装，请运行: pip install python-docx")
    except Exception as e:
        logger.error(f"Word 解析失败 {file_path}: {e}")
        raise


def extract_text_from_pptx(file_path: str) -> str:
    """使用 python-pptx 提取 PowerPoint 文本"""
    try:
        from pptx import Presentation
        prs = Presentation(file_path)
        texts = []
        for slide_num, slide in enumerate(prs.slides, 1):
            slide_texts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    slide_texts.append(shape.text.strip())
            if slide_texts:
                texts.append(f"[第{slide_num}页]\n" + "\n".join(slide_texts))
        return "\n\n".join(texts)
    except ImportError:
        raise ImportError("python-pptx 未安装，请运行: pip install python-pptx")
    except Exception as e:
        logger.error(f"PPT 解析失败 {file_path}: {e}")
        raise


def extract_text_from_txt(file_path: str) -> str:
    """提取纯文本文件内容"""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        logger.error(f"TXT 解析失败 {file_path}: {e}")
        raise


# 文件扩展名 → 解析函数映射
EXTRACTORS = {
    ".pdf": extract_text_from_pdf,
    ".docx": extract_text_from_docx,
    ".doc": extract_text_from_docx,    # 旧版 Word 也尝试 python-docx
    ".pptx": extract_text_from_pptx,
    ".ppt": extract_text_from_pptx,    # 旧版 PPT
    ".txt": extract_text_from_txt,
    ".md": extract_text_from_txt,
}

SUPPORTED_EXTENSIONS = set(EXTRACTORS.keys())


def extract_text_from_file(file_path: str) -> str:
    """
    根据文件扩展名自动选择解析器提取文本
    """
    ext = os.path.splitext(file_path)[1].lower()
    extractor = EXTRACTORS.get(ext)
    if not extractor:
        raise ValueError(
            f"不支持的文件格式: {ext}。"
            f"支持的格式：{', '.join(SUPPORTED_EXTENSIONS)}"
        )
    logger.info(f"正在提取文件内容: {file_path} (格式: {ext})")
    text = extractor(file_path)
    logger.info(f"文件提取完成: {file_path}，字符数={len(text)}")
    return text


def extract_texts_from_dir(dir_path: str) -> List[dict]:
    """
    遍历目录，提取所有支持格式文件的文本
    返回：[{"filename": str, "filepath": str, "text": str}]
    """
    results = []
    if not os.path.isdir(dir_path):
        return results

    for filename in os.listdir(dir_path):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        filepath = os.path.join(dir_path, filename)
        try:
            text = extract_text_from_file(filepath)
            if text.strip():
                results.append({
                    "filename": filename,
                    "filepath": filepath,
                    "text": text,
                })
        except Exception as e:
            logger.error(f"跳过文件 {filename}: {e}")
            continue

    return results
