"""
文件内容提取服务
支持：PDF、Word (.docx/.doc)、PowerPoint (.pptx/.ppt)、纯文本 (.txt/.md)、Excel (.xlsx/.xls)
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


def extract_text_from_excel(file_path: str) -> str:
    """
    提取 Excel 文件内容（.xlsx / .xls）
    每个 Sheet 单独标注，每行格式化为 「列名=值」，方便 RAG 检索。
    空行、全空列自动跳过。
    """
    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == ".xlsx":
            return _extract_xlsx(file_path)
        elif ext == ".xls":
            return _extract_xls(file_path)
        else:
            raise ValueError(f"不支持的 Excel 格式: {ext}")
    except (ImportError, ModuleNotFoundError) as e:
        raise ImportError(str(e))
    except Exception as e:
        logger.error(f"Excel 解析失败 {file_path}: {e}")
        raise


def _extract_xlsx(file_path: str) -> str:
    """使用 openpyxl 解析 .xlsx"""
    try:
        import openpyxl
    except ImportError:
        raise ImportError("openpyxl 未安装，请运行: pip install openpyxl")

    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    all_sheets: List[str] = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(values_only=True))
        sheet_text = _rows_to_text(sheet_name, rows)
        if sheet_text:
            all_sheets.append(sheet_text)

    wb.close()
    return "\n\n".join(all_sheets)


def _extract_xls(file_path: str) -> str:
    """使用 xlrd 解析 .xls（旧版 Excel）"""
    try:
        import xlrd
    except ImportError:
        raise ImportError("xlrd 未安装，请运行: pip install xlrd")

    wb = xlrd.open_workbook(file_path)
    all_sheets: List[str] = []

    for sheet in wb.sheets():
        rows = [
            tuple(sheet.cell_value(r, c) for c in range(sheet.ncols))
            for r in range(sheet.nrows)
        ]
        sheet_text = _rows_to_text(sheet.name, rows)
        if sheet_text:
            all_sheets.append(sheet_text)

    return "\n\n".join(all_sheets)


def _rows_to_text(sheet_name: str, rows: List[tuple]) -> str:
    """
    将行列数据转换为可供 RAG 检索的文本。
    策略：
    - 首行作为表头（列名）
    - 每个数据行格式化为：「列名1=值1 | 列名2=值2 | …」
    - 若无表头则直接以 tab 分隔输出
    - 过滤空行
    """
    if not rows:
        return ""

    # 过滤全为空的行
    non_empty_rows = [
        r for r in rows
        if any(v is not None and str(v).strip() != "" for v in r)
    ]
    if not non_empty_rows:
        return ""

    lines: List[str] = [f"[Sheet: {sheet_name}]"]

    # 取第一行作为表头
    header = [str(v).strip() if v is not None else "" for v in non_empty_rows[0]]
    has_header = any(h for h in header)

    if has_header:
        # 输出表头行（作为列名参考）
        lines.append("列名：" + " | ".join(h for h in header if h))
        # 输出数据行
        for row in non_empty_rows[1:]:
            cells = []
            for col_idx, val in enumerate(row):
                col_name = header[col_idx] if col_idx < len(header) else f"列{col_idx + 1}"
                cell_str = str(val).strip() if val is not None else ""
                if cell_str and cell_str != "None":
                    cells.append(f"{col_name}={cell_str}")
            if cells:
                lines.append(" | ".join(cells))
    else:
        # 无表头，直接输出每行
        for row in non_empty_rows:
            cell_strs = [
                str(v).strip()
                for v in row
                if v is not None and str(v).strip() not in ("", "None")
            ]
            if cell_strs:
                lines.append("\t".join(cell_strs))

    # 只有标题行，没有实际内容
    if len(lines) <= 2:
        return ""

    return "\n".join(lines)


# 文件扩展名 → 解析函数映射
EXTRACTORS = {
    ".pdf":  extract_text_from_pdf,
    ".docx": extract_text_from_docx,
    ".doc":  extract_text_from_docx,   # 旧版 Word 也尝试 python-docx
    ".pptx": extract_text_from_pptx,
    ".ppt":  extract_text_from_pptx,   # 旧版 PPT
    ".txt":  extract_text_from_txt,
    ".md":   extract_text_from_txt,
    ".xlsx": extract_text_from_excel,  # Excel 新版
    ".xls":  extract_text_from_excel,  # Excel 旧版
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
