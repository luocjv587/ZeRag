"""
阿里云通义千问 LLM 服务
包含：基础问答 / 查询改写 / HyDE / SQL 生成
"""
import json
from typing import List, Dict, Optional
import dashscope
from dashscope import Generation
from app.config import settings
from app.utils.logger import logger


def _setup_api_key():
    if settings.DASHSCOPE_API_KEY:
        dashscope.api_key = settings.DASHSCOPE_API_KEY


def chat_completion(messages: List[Dict[str, str]], model: str = "qwen-turbo") -> str:
    """调用通义千问，返回回答文本"""
    _setup_api_key()
    try:
        response = Generation.call(
            model=model,
            messages=messages,
            result_format="message",
        )
        if response.status_code == 200:
            return response.output.choices[0].message.content
        else:
            logger.error(f"DashScope error: {response.code} - {response.message}")
            raise Exception(f"LLM API error: {response.message}")
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise


# ─────────────────────────────────────────────
# Step 1 增强：查询改写 + 关键词提取
# ─────────────────────────────────────────────

def rewrite_query(question: str) -> Dict:
    """
    用百炼改写用户问题，返回：
    - keywords: 核心关键词列表（用于精确匹配）
    - queries: 语义变体列表（用于多路向量检索）
    - hyde_hint: 假设答案提示（用于 HyDE）
    """
    _setup_api_key()
    prompt = f"""你是一个数据库问答系统的查询优化专家。
用户提问："{question}"

请分析这个问题，输出 JSON 格式（只输出 JSON，不要其他内容）：
{{
  "keywords": ["关键词1", "关键词2"],      // 用于精确全文检索的核心词，2-5个
  "queries": ["改写问题1", "改写问题2", "改写问题3"],  // 语义相近的多种表达，3个
  "hyde_hint": "一句话描述：如果数据库中存在相关记录，记录内容大概是..."  // 用于生成假设文档
}}

示例：
用户问："曾强是谁"
输出：
{{
  "keywords": ["曾强"],
  "queries": ["曾强的用户信息", "名字叫曾强的人员", "曾强 账号 角色"],
  "hyde_hint": "用户表中有一条记录，姓名为曾强，包含其角色、部门、联系方式等信息"
}}"""

    try:
        response = Generation.call(
            model="qwen-turbo",
            messages=[{"role": "user", "content": prompt}],
            result_format="message",
        )
        if response.status_code == 200:
            content = response.output.choices[0].message.content.strip()
            # 提取 JSON 部分
            if "```" in content:
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
    except Exception as e:
        logger.warning(f"Query rewrite failed: {e}, using original")

    # 失败时返回原始问题
    return {
        "keywords": [question],
        "queries": [question],
        "hyde_hint": question,
    }


# ─────────────────────────────────────────────
# Step 1 增强：HyDE（假设文档嵌入）
# ─────────────────────────────────────────────

def generate_hyde_document(question: str, hyde_hint: str) -> str:
    """
    生成一段假设性的数据库记录文本，用于 HyDE 向量化。
    目标：生成的文本在语义空间中更接近真实答案。
    """
    _setup_api_key()
    prompt = f"""你是一个数据库记录生成助手。
用户问题："{question}"
背景提示：{hyde_hint}

请生成一段简短的假设性数据库记录描述（50-100字），
就像这条记录真实存在于数据库中一样。
只输出记录描述文本，不要解释。"""

    try:
        response = Generation.call(
            model="qwen-turbo",
            messages=[{"role": "user", "content": prompt}],
            result_format="message",
        )
        if response.status_code == 200:
            return response.output.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"HyDE generation failed: {e}")

    return question  # 降级为原始问题


# ─────────────────────────────────────────────
# Step 2 增强：SQL 兜底生成
# ─────────────────────────────────────────────

def generate_sql_query(
    question: str,
    table_schemas: List[Dict],
    db_type: str = "mysql",
) -> Optional[str]:
    """
    当向量检索相似度过低时，让百炼直接根据表结构生成 SQL 查询。
    table_schemas: [{"table": "user", "columns": ["id", "name", "role", ...]}]
    """
    _setup_api_key()

    schema_text = "\n".join([
        f"表 {s['table']}：字段 {', '.join(s['columns'])}"
        for s in table_schemas
    ])

    prompt = f"""你是一个 {db_type.upper()} 数据库专家。
已知数据库表结构：
{schema_text}

用户问题："{question}"

请生成一条能回答此问题的 SQL 查询语句。
要求：
- 只输出 SQL 语句，不要解释
- 使用 LIMIT 10 限制结果数量
- 如果问题涉及模糊查询，用 LIKE '%关键词%'
- 如果无法生成有效 SQL，输出：CANNOT_GENERATE

SQL："""

    try:
        response = Generation.call(
            model="qwen-turbo",
            messages=[{"role": "user", "content": prompt}],
            result_format="message",
        )
        if response.status_code == 200:
            sql = response.output.choices[0].message.content.strip()
            # 清理 markdown 代码块
            if "```" in sql:
                sql = sql.split("```")[1]
                if sql.startswith("sql"):
                    sql = sql[3:]
            sql = sql.strip()
            if sql == "CANNOT_GENERATE" or not sql:
                return None
            return sql
    except Exception as e:
        logger.error(f"SQL generation failed: {e}")

    return None
