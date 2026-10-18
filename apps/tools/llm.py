import json
import re
import time
from openai import OpenAI
from apps import config
from apps.models.model import Config
from apps.tools.logger import llm_logger


def get_llm_client_and_model():
    """
    优先从数据库 config 表获取 LLM 运行时配置，其次降级从系统环境变量读取。
    支持对接 OpenAI、DeepSeek、Moonshot、Ollama、阿里云百炼、通义千问等所有 OpenAI-compatible 提供商。
    """
    db_configs = {c.name: c.value for c in Config.query.all()} if Config.query.first() else {}

    api_key = db_configs.get('llm_api_key') or config.OPENAI_API_KEY or ''
    base_url = db_configs.get('llm_base_url') or config.OPENAI_BASE_URL or 'https://api.openai.com/v1'
    model = db_configs.get('llm_model') or config.OPENAI_MODEL or 'gpt-4o-mini'

    if not api_key:
        llm_logger.warning("大模型调用被拦截: 尚未配置大模型 API Key")
        raise ValueError("尚未配置大模型 API Key！请在后台「系统设置」->「AI 大模型」配置 API Key 或在 .env 中设置 OPENAI_API_KEY。")

    client = OpenAI(
        api_key=api_key.strip(),
        base_url=base_url.strip().rstrip('/'),
        timeout=60.0
    )
    return client, model.strip()


def llm_chat_completion(system_prompt: str, user_prompt: str, temperature: float = 0.5, json_mode: bool = False) -> str:
    """调用大模型生成文本完成。"""
    client, model = get_llm_client_and_model()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    start_time = time.time()
    llm_logger.info(f"发起大模型请求 [Model: {model}, json_mode: {json_mode}]")
    try:
        response = client.chat.completions.create(**kwargs)
        duration_s = time.time() - start_time
        llm_logger.info(f"大模型响应完成 [Model: {model}] 耗时: {duration_s:.2f}s")
        return response.choices[0].message.content or ""
    except Exception as e:
        duration_s = time.time() - start_time
        llm_logger.error(f"大模型调用失败 [Model: {model}] 耗时: {duration_s:.2f}s, 错误: {e}")
        raise e


def parse_llm_json(text: str) -> dict:
    """
    鲁棒解析大模型返回的 JSON 内容：
    1. 自动兼容并剥离 Markdown 代码块（```json ... ``` 或 ``` ... ```）；
    2. 自动截取提取最外层有效大括号 {...}；
    3. 自动容错尾随多余逗号 (trailing comma)；
    4. 自动解包外层被意外包裹的列表单元素 [ {...} ]。
    """
    if not text or not text.strip():
        raise ValueError("大模型响应内容为空，未生成有效数据")

    raw = text.strip()

    def _ensure_dict(obj):
        if isinstance(obj, dict):
            return obj
        if isinstance(obj, list) and len(obj) > 0 and isinstance(obj[0], dict):
            return obj[0]
        raise ValueError(f"大模型返回的数据结构不是有效 JSON 对象 (得到: {type(obj).__name__})")

    # 1. 直接尝试标准反序列化
    try:
        return _ensure_dict(json.loads(raw))
    except Exception:
        pass

    cleaned = raw

    # 2. 剥离 Markdown 格式代码块 (```json ... ``` 或 ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()
        try:
            return _ensure_dict(json.loads(cleaned))
        except Exception:
            pass

    # 3. 贪婪提取最外层的 { ... } 或 [ ... ]
    brace_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", cleaned)
    if brace_match:
        cleaned = brace_match.group(1).strip()
        try:
            return _ensure_dict(json.loads(cleaned))
        except Exception:
            pass

    # 4. 容错处理结尾多余逗号 (Trailing comma)
    cleaned_no_trailing = re.sub(r",\s*([}\]])", r"\1", cleaned)
    try:
        return _ensure_dict(json.loads(cleaned_no_trailing))
    except Exception as e:
        raise ValueError(f"大模型返回内容无法解析为有效 JSON (原始响应前200字: {raw[:200]!r}): {e}")
