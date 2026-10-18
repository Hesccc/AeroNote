import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from apps.exts import db
from apps.models.model import Categories, Tags
from apps.tools.llm import llm_chat_completion, parse_llm_json
from apps.tools.ai_prompts import get_prompt_template, get_all_prompts_info, save_prompt_template
from .middleware import token_required

api_ai = Blueprint('api_ai', __name__)


# ─── 自定义提示词 (Prompt) 管理接口 ──────────────────────────────────────────────

@api_ai.route('/api/manage/ai/prompts', methods=['GET'])
@token_required
def ai_get_prompts():
    """获取所有 AI 任务项的提示词配置（包含默认值与自定义状态）。"""
    return jsonify({'prompts': get_all_prompts_info()})


@api_ai.route('/api/manage/ai/prompts', methods=['PUT'])
@token_required
def ai_update_prompt():
    """保存或恢复指定任务项的自定义 Prompt。"""
    data = request.get_json() or {}
    key = data.get('key', '').strip()
    value = data.get('value', '').strip()

    if not key:
        return jsonify({'msg': 'Prompt 任务项标识 key 不能为空'}), 400

    ok = save_prompt_template(key, value)
    if not ok:
        return jsonify({'msg': f'未知的 Prompt 任务项: {key}'}), 400

    return jsonify({
        'msg': '提示词配置已成功保存并实时生效！',
        'prompts': get_all_prompts_info()
    })


# ─── 定时任务管理与日志查询接口 ──────────────────────────────────────────────

@api_ai.route('/api/manage/ai/scheduler/status', methods=['GET'])
@token_required
def ai_get_scheduler_status():
    """获取定时任务当前开关、运行健康度与待完善文章数"""
    from apps.tools.ai_scheduler import get_scheduler_status
    return jsonify(get_scheduler_status())


@api_ai.route('/api/manage/ai/scheduler/toggle', methods=['POST'])
@token_required
def ai_toggle_scheduler():
    """开启或禁用 AI 自动定时任务"""
    data = request.get_json() or {}
    enabled = bool(data.get('enabled', True))
    from apps.tools.ai_scheduler import set_scheduler_enabled, get_scheduler_status
    set_scheduler_enabled(enabled)
    return jsonify(get_scheduler_status())


@api_ai.route('/api/manage/ai/scheduler/trigger', methods=['POST'])
@token_required
def ai_trigger_scheduler():
    """管理员手动触发一次即时扫描批处理"""
    from apps.tools.ai_scheduler import trigger_scheduler_once
    res = trigger_scheduler_once()
    return jsonify(res)


@api_ai.route('/api/manage/ai/scheduler/cron', methods=['POST'])
@token_required
def ai_set_scheduler_cron():
    """更新定时任务 Cron 表达式"""
    data = request.get_json() or {}
    cron_expr = data.get('cron', '').strip()
    if not cron_expr:
        return jsonify({'msg': 'Cron 表达式不能为空'}), 400

    from apps.tools.ai_scheduler import set_scheduler_cron, get_scheduler_status
    try:
        updated_cron = set_scheduler_cron(cron_expr)
        status = get_scheduler_status()
        return jsonify({
            'success': True,
            'msg': f'Cron 表达式已更新为 [{updated_cron}]，下次执行时间: {status.get("next_run_time")}',
            'status': status
        })
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400
    except Exception as e:
        return jsonify({'msg': f'保存 Cron 表达式失败: {str(e)}'}), 500


@api_ai.route('/api/manage/ai/scheduler/threads', methods=['POST'])
@token_required
def ai_set_scheduler_threads():
    """更新定时任务并发处理线程数 (1~10)"""
    data = request.get_json() or {}
    try:
        thread_count = int(data.get('threads', 3))
        if thread_count < 1 or thread_count > 10:
            return jsonify({'msg': '并发线程数必须介于 1 到 10 之间'}), 400
    except (ValueError, TypeError):
        return jsonify({'msg': '线程数格式无效'}), 400

    from apps.tools.ai_scheduler import set_scheduler_threads, get_scheduler_status
    try:
        updated = set_scheduler_threads(thread_count)
        status = get_scheduler_status()
        return jsonify({
            'success': True,
            'msg': f'并发处理线程数已设置为 {updated} 线程',
            'status': status
        })
    except Exception as e:
        return jsonify({'msg': f'保存线程数设置失败: {str(e)}'}), 500


@api_ai.route('/api/manage/ai/scheduler/logs', methods=['GET'])
@token_required
def ai_get_scheduler_logs():
    """获取最近 200 条调度器执行日志"""
    from apps.tools.ai_scheduler import get_scheduler_logs
    return jsonify({'logs': get_scheduler_logs()})


@api_ai.route('/api/manage/ai/test-connection', methods=['POST'])
@token_required
def ai_test_connection():
    """
    测试大模型 API Key、Base URL 与 Model 连通性。
    支持前端在未保存前传入草稿参数快速测试，也支持读取已保存的配置测试。
    """
    data = request.get_json() or {}
    custom_api_key = data.get('api_key', '').strip()
    custom_base_url = data.get('base_url', '').strip()
    custom_model = data.get('model', '').strip()

    from apps.tools.llm import get_llm_client_and_model
    from openai import OpenAI

    try:
        db_client, db_model = get_llm_client_and_model()

        api_key = custom_api_key or db_client.api_key
        base_url = (custom_base_url or str(db_client.base_url)).rstrip('/')
        model_name = custom_model or db_model

        client = OpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=20.0
        )

        # 尝试发送一次极简 Prompt 进行握手与鉴权
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a healthcheck assistant. Respond with PONG."},
                {"role": "user", "content": "PING"}
            ],
            max_tokens=10,
            temperature=0.1
        )
        reply = response.choices[0].message.content or ''
        return jsonify({
            'success': True,
            'msg': f'连接成功！模型 [{model_name}] 握手响应正常',
            'reply': reply.strip()
        })
    except Exception as e:
        error_msg = str(e)
        if 'model_not_found' in error_msg or 'unknown provider' in error_msg:
            return jsonify({
                'success': False,
                'msg': f'模型名称不存在或不受支持: 请检查输入的模型 ID 是否准确 (当前输入: {custom_model or "未填写"})\n详细错误: {error_msg}'
            }), 400
        elif 'Authentication' in error_msg or '401' in error_msg:
            return jsonify({
                'success': False,
                'msg': f'API Key 鉴权失败 (401 Unauthorized)，请检查 Key 是否有效\n详细错误: {error_msg}'
            }), 400
        return jsonify({
            'success': False,
            'msg': f'连通性测试失败: {error_msg}'
        }), 500


@api_ai.route('/api/manage/ai/analyze-taxonomy', methods=['POST'])
@token_required
def ai_analyze_taxonomy():
    """
    功能 2：分析文章内容，生成适合文章的分类与标签。
    硬约束：只能增加分类与标签，绝不删除已有分类与标签。
    若推荐的分类/标签已存在，则关联；若不存在，则自动在库中新增并返回关联 ID。
    """
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title and not content:
        return jsonify({'msg': '文章标题或内容不能为空'}), 400

    # 查出现有的所有分类和标签作为 LLM 的优先候选
    existing_categories = Categories.query.filter(Categories.deleted == 0).all()
    existing_tags = Tags.query.filter(Tags.deleted == 0).all()

    existing_cat_names = [c.name for c in existing_categories]
    existing_tag_names = [t.name for t in existing_tags]

    # 获取自定义或默认分类 Prompt，替换占位符
    tpl = get_prompt_template('prompt_taxonomy')
    system_prompt = tpl.replace('{category_list}', json.dumps(existing_cat_names, ensure_ascii=False))\
                       .replace('{tag_list}', json.dumps(existing_tag_names, ensure_ascii=False))

    user_prompt = f"文章标题：{title}\n\n文章内容节选：\n{content[:4000]}"

    try:
        reply = llm_chat_completion(system_prompt, user_prompt, temperature=0.3, json_mode=True)
        result = parse_llm_json(reply)
        rec_category_name = (result.get('category') or '').strip()
        rec_tag_names = [t.strip() for t in result.get('tags', []) if t.strip()]
    except Exception as e:
        return jsonify({'msg': f'大模型分析分类标签失败: {str(e)}'}), 500

    now = datetime.now()
    matched_category = None
    created_categories = []

    # 处理分类匹配或新增
    if rec_category_name:
        cat = Categories.query.filter(Categories.name == rec_category_name, Categories.deleted == 0).first()
        if not cat:
            # 自动新建分类（只增不删原则）
            import re
            slug = re.sub(r'[^a-zA-Z0-9]', '', rec_category_name).lower() or f"cat-{int(now.timestamp())}"
            cat = Categories(
                name=rec_category_name,
                slug=slug,
                description=f"AI自动提取分类: {rec_category_name}",
                color="#4f46e5",
                parent_id=0,
                deleted=0,
                create_time=now,
                update_time=now
            )
            db.session.add(cat)
            db.session.flush()
            created_categories.append({'id': cat.id, 'name': cat.name, 'slug': cat.slug})
        matched_category = {'id': cat.id, 'name': cat.name, 'slug': cat.slug}

    # 处理标签匹配或新增
    matched_tags = []
    created_tags = []
    for tag_name in rec_tag_names:
        tag = Tags.query.filter(Tags.name == tag_name, Tags.deleted == 0).first()
        if not tag:
            import re
            slug = re.sub(r'[^a-zA-Z0-9]', '', tag_name).lower() or f"tag-{int(now.timestamp())}"
            tag = Tags(
                name=tag_name,
                slug=slug,
                color="#06b6d4",
                deleted=0,
                create_time=now,
                update_time=now
            )
            db.session.add(tag)
            db.session.flush()
            created_tags.append({'id': tag.id, 'name': tag.name, 'slug': tag.slug})
        matched_tags.append({'id': tag.id, 'name': tag.name, 'slug': tag.slug})

    db.session.commit()

    return jsonify({
        'category': matched_category,
        'tags': matched_tags,
        'created_categories': created_categories,
        'created_tags': created_tags
    })


@api_ai.route('/api/manage/ai/generate-summary', methods=['POST'])
@token_required
def ai_generate_summary():
    """
    功能 3：对文章内容进行深入分析，提炼合适的文章内容简要描述 (Summary)。
    字数严格控制在 200 字以内，语言简练通顺，提炼核心论点与关键技术点。
    如果提供了 post_id，则自动将摘要持久化保存至数据库 posts 表的 summary 字段中。
    """
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    post_id = data.get('post_id')

    from apps.models.model import Posts

    if not content and post_id:
        p = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first()
        if p:
            content = p.content or ''
            title = title or p.title

    if not content:
        return jsonify({'msg': '文章内容不能为空'}), 400

    system_prompt = get_prompt_template('prompt_summary')

    user_prompt = f"文章标题：{title}\n\n正文：\n{content[:6000]}"

    try:
        summary = llm_chat_completion(system_prompt, user_prompt, temperature=0.3).strip()
        # 兜底截断，保证不超过 200 字
        if len(summary) > 200:
            summary = summary[:197] + '...'

        if post_id:
            p = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first()
            if p:
                p.summary = summary
                db.session.commit()

        return jsonify({'summary': summary, 'post_id': post_id})
    except Exception as e:
        return jsonify({'msg': f'生成文章摘要失败: {str(e)}'}), 500


@api_ai.route('/api/manage/ai/proofread', methods=['POST'])
@token_required
def ai_proofread():
    """
    功能 4-A：对文章进行病句检查、错别字修正与技术表达润色。
    返回修正后的文本以及详细的修改点清单。
    """
    data = request.get_json() or {}
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'msg': '待检查内容不能为空'}), 400

    system_prompt = get_prompt_template('prompt_proofread')

    user_prompt = f"请校对以下文本：\n\n{content[:8000]}"

    try:
        reply = llm_chat_completion(system_prompt, user_prompt, temperature=0.2, json_mode=True)
        res = parse_llm_json(reply)
        return jsonify({
            'revised_content': res.get('revised_content') or content,
            'suggestions': res.get('suggestions') or []
        })
    except Exception as e:
        return jsonify({'msg': f'文本校对失败: {str(e)}'}), 500


@api_ai.route('/api/manage/ai/expand', methods=['POST'])
@token_required
def ai_expand():
    """
    功能 4-B：对选定或指定的文章内容/大纲进行智能扩写与细节丰富。
    支持在原文后补充实战案例、常见问题排查（FAQ）、最佳实践或深入原理解释。
    """
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    instruction = data.get('instruction', '补充技术深度与排查实战案例').strip()

    if not content:
        return jsonify({'msg': '待扩写内容不能为空'}), 400

    system_prompt = get_prompt_template('prompt_expand')

    user_prompt = f"文章标题：{title}\n扩写要求：{instruction}\n\n当前文章正文：\n{content[:6000]}"

    try:
        expanded = llm_chat_completion(system_prompt, user_prompt, temperature=0.6)
        return jsonify({'expanded_content': expanded.strip()})
    except Exception as e:
        return jsonify({'msg': f'内容扩写失败: {str(e)}'}), 500
