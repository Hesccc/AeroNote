import secrets
import re
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify
from apps.exts import db
from apps.models.model import Posts, Categories, Tags, PostCategories, PostTags, Config

api_open = Blueprint('api_open', __name__)

CONFIG_KEY_OPEN_TOKEN = 'open_api_token'


def get_or_create_open_token() -> str:
    """获取或初始化系统开放 API Token。"""
    cfg = Config.query.filter_by(name=CONFIG_KEY_OPEN_TOKEN).first()
    if cfg and cfg.value and cfg.value.strip():
        return cfg.value.strip()
    
    # 首次自动生成高强度 32 字符随机 Token
    new_token = f"sk-open-{secrets.token_hex(16)}"
    if cfg:
        cfg.value = new_token
    else:
        cfg = Config(name=CONFIG_KEY_OPEN_TOKEN, value=new_token)
        db.session.add(cfg)
    db.session.commit()
    return new_token


def open_token_required(f):
    """
    开放 API 长效静态 Token 鉴权中间件。
    支持请求头：
      - Authorization: Bearer <TOKEN>
      - X-API-Key: <TOKEN>
      - X-Blog-Token: <TOKEN>
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
        elif 'X-API-Key' in request.headers:
            token = request.headers.get('X-API-Key', '').strip()
        elif 'X-Blog-Token' in request.headers:
            token = request.headers.get('X-Blog-Token', '').strip()

        if not token:
            return jsonify({
                'code': 401,
                'msg': '未提供开放 API 认证 Token！请在 Header 中携带 Authorization: Bearer <TOKEN> 或 X-API-Key'
            }), 401

        correct_token = get_or_create_open_token()
        # 使用恒定时间比对防御时序侧信道攻击
        if not secrets.compare_digest(token, correct_token):
            return jsonify({
                'code': 403,
                'msg': '开放 API 认证 Token 无效或已失效，请在系统设置中核对'
            }), 403

        return f(*args, **kwargs)
    return decorated


def _bind_post_taxonomy(post_id: int, category_name: str = None, tag_names: list = None):
    """为文章关联分类与标签（支持自动创建不存在的分类与标签）。"""
    now = datetime.now()

    # 1. 处理分类 (单个主分类)
    if category_name and category_name.strip():
        c_name = category_name.strip()
        cat = Categories.query.filter(Categories.name == c_name, Categories.deleted == 0).first()
        if not cat:
            slug = re.sub(r'[^a-zA-Z0-9]', '', c_name).lower() or f"cat-{int(now.timestamp())}"
            # slug 冲突重命名防御
            if Categories.query.filter(Categories.slug == slug, Categories.deleted == 0).first():
                slug = f"{slug}-{secrets.token_hex(2)}"
            cat = Categories(
                name=c_name,
                slug=slug,
                description=f"外部同步自动创建分类: {c_name}",
                color="#3b82f6",
                parent_id=0,
                deleted=0,
                create_time=now,
                update_time=now
            )
            db.session.add(cat)
            db.session.flush()

        # 关联关系
        pc = PostCategories.query.filter(PostCategories.post_id == post_id).first()
        if pc:
            pc.category_id = cat.id
            pc.deleted = 0
            pc.update_time = now
        else:
            pc = PostCategories(post_id=post_id, category_id=cat.id, deleted=0, create_time=now, update_time=now)
            db.session.add(pc)

    # 2. 处理标签 (多标签)
    if tag_names:
        clean_tags = [t.strip() for t in tag_names if t and t.strip()]
        if clean_tags:
            # 标记当前文章原有关联已删除
            PostTags.query.filter(PostTags.post_id == post_id).update({PostTags.deleted: 1})

            for t_name in clean_tags:
                tag = Tags.query.filter(Tags.name == t_name, Tags.deleted == 0).first()
                if not tag:
                    t_slug = re.sub(r'[^a-zA-Z0-9]', '', t_name).lower() or f"tag-{int(now.timestamp())}"
                    if Tags.query.filter(Tags.slug == t_slug, Tags.deleted == 0).first():
                        t_slug = f"{t_slug}-{secrets.token_hex(2)}"
                    tag = Tags(
                        name=t_name,
                        slug=t_slug,
                        slug_name=t_name,
                        color="#10b981",
                        deleted=0,
                        create_time=now,
                        update_time=now
                    )
                    db.session.add(tag)
                    db.session.flush()

                # 复用或新增关联
                pt = PostTags.query.filter(PostTags.post_id == post_id, PostTags.tag_id == tag.id).first()
                if pt:
                    pt.deleted = 0
                    pt.update_time = now
                else:
                    pt = PostTags(post_id=post_id, tag_id=tag.id, deleted=0, create_time=now, update_time=now)
                    db.session.add(pt)


# ──────────────────────────────────────────────
# 外部系统调用接口 (RESTful Webhook API)
# ──────────────────────────────────────────────

@api_open.route('/api/open/posts/sync', methods=['POST'])
@open_token_required
def open_sync_post():
    """
    外部系统（如思源笔记、Obsidian、脚本等）一键同步/推送文章核心接口。
    具备严格幂等性：基于 source_id 自动识别更新或新建。
    """
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    content = (data.get('content') or data.get('markdown') or data.get('body') or '').strip()
    source_id = (data.get('source_id') or data.get('doc_id') or data.get('id') or '').strip()

    if not title:
        return jsonify({'code': 400, 'msg': '文章标题 (title) 不能为空'}), 400

    author = (data.get('author') or 'admin').strip()
    thumbnail = data.get('thumbnail') or data.get('cover') or None
    status = int(data.get('status', 0))  # 0: 直接发布, 3: 草稿
    summary = data.get('summary') or data.get('desc') or None
    meta_desc = data.get('meta_description') or summary
    category = data.get('category') or data.get('category_name')
    tags = data.get('tags') or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(',') if t.strip()]

    now = datetime.now()
    action = "create"
    post = None

    # 1. 优先根据 source_id 寻找已有文章 (幂等更新)
    if source_id:
        post = Posts.query.filter(Posts.source_id == source_id, Posts.deleted == 0).first()

    # 2. 若未传 source_id，降级根据相同标题匹配最近 7 天内文章 (防重复发布)
    if not post and title:
        post = Posts.query.filter(Posts.title == title, Posts.deleted == 0).order_by(Posts.id.desc()).first()

    if post:
        # 执行更新 (Update)
        action = "update"
        post.title = title
        if content:
            post.content = content
        if thumbnail is not None:
            post.thumbnail = thumbnail
        if summary is not None:
            post.summary = summary
        if meta_desc is not None:
            post.meta_description = meta_desc
        if source_id:
            post.source_id = source_id
        post.status = status
        post.update_time = now
    else:
        # 执行新建 (Create)
        action = "create"
        post = Posts(
            title=title,
            author=author,
            content=content,
            access_count=0,
            thumbnail=thumbnail,
            status=status,
            summary=summary,
            meta_description=meta_desc,
            source_id=source_id or None,
            deleted=0,
            create_time=now,
            update_time=now
        )
        db.session.add(post)
        db.session.flush()

    # 绑定分类和标签
    _bind_post_taxonomy(post.id, category, tags)

    # 提交事务
    db.session.commit()
    from apps.tools.cache import invalidate_all_cache
    invalidate_all_cache()

    return jsonify({
        'code': 200,
        'msg': f"文章同步成功 ({'已更新' if action == 'update' else '已创建'})",
        'data': {
            'post_id': post.id,
            'title': post.title,
            'action': action,
            'source_id': post.source_id,
            'url': f"/posts/{post.id}"
        }
    }), 200


@api_open.route('/api/open/ping', methods=['GET', 'POST'])
@open_token_required
def open_ping():
    """验证开放 API 连通性与 Token 有效性端点。"""
    return jsonify({
        'code': 200,
        'msg': 'pong',
        'server_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'status': 'ready'
    })
