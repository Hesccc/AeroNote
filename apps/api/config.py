from flask import Blueprint, request, jsonify, Response
import secrets
from apps.exts import db
from apps.models.model import Config, Posts, Categories, Tags
from apps.tools.tools import env
from apps.api.open import get_or_create_open_token, CONFIG_KEY_OPEN_TOKEN
from .middleware import token_required

api_config = Blueprint('api_config', __name__)

@api_config.route('/robots.txt', methods=['GET'])
def get_robots_txt():
    """动态生成 robots.txt，根据后台 SEO 收录总开关控制搜索引擎爬虫行为。"""
    seo_enabled = Config.query.filter_by(name='seo_enabled').first()
    # 默认开启 (值为 'true' 或 '1' 或未设置时视为允许收录)
    is_allowed = (seo_enabled is None) or (seo_enabled.value in ('true', '1'))
    
    if is_allowed:
        website_url = Config.query.filter_by(name='website_url').first()
        base_url = website_url.value.rstrip('/') if website_url and website_url.value else ''
        content = (
            "User-agent: *\n"
            "Allow: /\n"
            "Disallow: /admin/\n"
            "Disallow: /api/\n"
            "Disallow: /apis/\n"
        )
        if base_url:
            content += f"\nSitemap: {base_url}/sitemap.xml\n"
    else:
        # 完全禁止所有搜索引擎抓取本站任何页面
        content = (
            "User-agent: *\n"
            "Disallow: /\n"
        )
    return Response(content, mimetype='text/plain')

@api_config.route('/api/config', methods=['GET'])
def get_config():
    configs = Config.query.all()
    # 敏感配置项过滤，不暴露给前台匿名用户
    sensitive_keys = {'open_api_token', 'ai_api_key'}
    config_dict = {c.name: c.value for c in configs if c.name not in sensitive_keys}
    return jsonify(config_dict)

@api_config.route('/api/manage/open-token', methods=['GET', 'POST'])
@token_required
def manage_open_token():
    """管理端获取或重置开放 API 密钥 Token。"""
    if request.method == 'POST':
        # 重置生成全新 Token
        new_token = f"sk-open-{secrets.token_hex(16)}"
        cfg = Config.query.filter_by(name=CONFIG_KEY_OPEN_TOKEN).first()
        if cfg:
            cfg.value = new_token
        else:
            cfg = Config(name=CONFIG_KEY_OPEN_TOKEN, value=new_token)
            db.session.add(cfg)
        db.session.commit()
        return jsonify({'token': new_token, 'msg': '已成功重新生成开放 API 密钥！'})
    
    token = get_or_create_open_token()
    return jsonify({'token': token})

@api_config.route('/api/manage/config', methods=['PUT'])
@token_required
def update_config():
    data = request.get_json() or {}
    for name, value in data.items():
        if not name:
            continue
        conf = Config.query.filter_by(name=name).first()
        if conf:
            conf.value = str(value)
        else:
            new_conf = Config(name=name, value=str(value))
            db.session.add(new_conf)
    db.session.commit()
    
    # Return updated config
    configs = Config.query.all()
    config_dict = {c.name: c.value for c in configs}
    return jsonify(config_dict)

@api_config.route('/api/manage/env', methods=['GET'])
@token_required
def get_env():
    env_data = env()
    if 'datetime' in env_data:
        env_data['datetime'] = env_data['datetime'].isoformat()
    return jsonify(env_data)

@api_config.route('/api/manage/stats', methods=['GET'])
@token_required
def get_stats():
    # 1. 基础文档数量统计
    total_posts = Posts.query.filter(Posts.deleted == 0).count()
    published_posts = Posts.query.filter(Posts.deleted == 0, Posts.status == 0).count()
    draft_posts = Posts.query.filter(Posts.deleted == 0, Posts.status == 3).count()
    total_categories = Categories.query.filter(Categories.deleted == 0).count()
    total_tags = Tags.query.filter(Tags.deleted == 0).count()
    total_views = db.session.query(db.func.sum(Posts.access_count)).filter(Posts.deleted == 0).scalar() or 0

    # 2. 深度文档字数与体量分析
    all_posts = Posts.query.filter(Posts.deleted == 0).all()
    total_words = sum(len(p.content or '') for p in all_posts)
    avg_words = int(total_words / total_posts) if total_posts else 0
    with_cover_posts = sum(1 for p in all_posts if p.thumbnail and p.thumbnail.strip())
    without_cover_posts = total_posts - with_cover_posts

    # 3. 最热门文章排行 Top 5
    top_posts = (
        Posts.query.filter(Posts.deleted == 0)
        .order_by(Posts.access_count.desc())
        .limit(5)
        .all()
    )
    top_posts_data = [{
        'id': p.id,
        'title': p.title,
        'access_count': p.access_count or 0,
        'create_time': p.create_time.strftime('%Y-%m-%d') if p.create_time else '-'
    } for p in top_posts]

    # 4. 近期最新发布的文章
    recent_posts = (
        Posts.query.filter(Posts.deleted == 0)
        .order_by(Posts.create_time.desc())
        .limit(5)
        .all()
    )
    recent_posts_data = [{
        'id': p.id,
        'title': p.title,
        'status': p.status,
        'create_time': p.create_time.strftime('%Y-%m-%d') if p.create_time else '-'
    } for p in recent_posts]

    # 5. AI 定时调度任务与运行态指标
    from apps.tools.ai_scheduler import get_scheduler_status
    scheduler_info = get_scheduler_status()

    return jsonify({
        # 文档统计维度
        'total_posts': total_posts,
        'published_posts': published_posts,
        'draft_posts': draft_posts,
        'total_categories': total_categories,
        'total_tags': total_tags,
        'total_views': int(total_views),
        # 文档深度分析维度
        'total_words': total_words,
        'avg_words': avg_words,
        'with_cover_posts': with_cover_posts,
        'without_cover_posts': without_cover_posts,
        'top_posts': top_posts_data,
        'recent_posts': recent_posts_data,
        # AI 任务运行监控维度
        'ai_scheduler': scheduler_info,
    })
