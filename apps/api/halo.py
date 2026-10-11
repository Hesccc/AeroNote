"""
Halo 2.x REST API 兼容层
-----------------------
为思源笔记 siyuan-plugin-publisher 插件中的「Halo29」平台适配器提供无缝兼容支持。
实现端点：
- GET  /apis/content.halo.run/v1alpha1/categories (验证鉴权与获取分类)
- POST /apis/content.halo.run/v1alpha1/categories (创建分类)
- GET  /apis/content.halo.run/v1alpha1/tags (获取标签)
- POST /apis/content.halo.run/v1alpha1/tags (创建标签)
- POST /apis/api.console.halo.run/v1alpha1/posts (新建文章草稿)
- PUT  /apis/api.console.halo.run/v1alpha1/posts/<name>/publish (发布文章)
- GET  /apis/content.halo.run/v1alpha1/posts/<name> (获取文章元信息)
- GET  /apis/api.console.halo.run/v1alpha1/posts/<name>/head-content (获取文章内容)
- PUT  /apis/content.halo.run/v1alpha1/posts/<name> (更新文章元信息)
- PUT  /apis/api.console.halo.run/v1alpha1/posts/<name>/content (更新文章内容)
- PUT  /apis/api.console.halo.run/v1alpha1/posts/<name>/recycle (删除/回收文章)
- POST /apis/api.console.halo.run/v1alpha1/attachments/upload (附件/图片上传)
"""
import base64
import re
import uuid
from datetime import datetime
from pathlib import Path
from functools import wraps
from flask import Blueprint, request, jsonify, g
from apps.exts import db
from apps.models.model import Posts, Categories, Tags, PostCategories, PostTags, User
from apps.models.oss_image import OssImage
from apps.tools.tools import verify_and_upgrade_password
from apps.api.open import get_or_create_open_token
from apps import config

api_halo = Blueprint('api_halo', __name__)


def halo_auth_required(f):
    """
    Halo API 鉴权中间件：
    支持 Basic Auth (username:password) 或 Bearer Token。
    password 可为系统管理员密码，也可为系统开放 API Token。
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        authenticated = False

        if auth_header.startswith('Basic '):
            try:
                b64_str = auth_header.split(' ', 1)[1].strip()
                decoded = base64.b64decode(b64_str).decode('utf-8', errors='ignore')
                username, password = decoded.split(':', 1)
                
                # 1. 验证是否为开放 API Token
                open_token = get_or_create_open_token()
                if password == open_token or username == open_token:
                    authenticated = True
                else:
                    # 2. 验证是否为数据库管理员密码
                    user = User.query.filter_by(username=username).first()
                    if user and verify_and_upgrade_password(user, password, db.session):
                        authenticated = True
            except Exception:
                pass
        elif auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1].strip()
            open_token = get_or_create_open_token()
            if token == open_token:
                authenticated = True

        if not authenticated:
            return jsonify({
                'title': 'Unauthorized',
                'status': 401,
                'detail': '用户名或密码/Token错误，请核对思源笔记发布插件配置'
            }), 401

        return f(*args, **kwargs)
    return decorated


# ──────────────────────────────────────────────
# 1. 分类 (Categories)
# ──────────────────────────────────────────────

@api_halo.route('/apis/content.halo.run/v1alpha1/categories', methods=['GET'])
@halo_auth_required
def halo_get_categories():
    """获取所有分类（思源验证与发布初始化必须）"""
    cats = Categories.query.filter(Categories.deleted == 0).order_by(Categories.priority.desc(), Categories.id.asc()).all()
    items = []
    
    # 若无分类，提供默认分类，确保思源插件经过 afterValid() 成功完成验证
    if not cats:
        items.append({
            'spec': {
                'displayName': '默认分类',
                'slug': 'default',
                'description': '默认文章分类',
                'cover': '',
                'priority': 0
            },
            'status': {
                'permalink': '/categories'
            },
            'metadata': {
                'name': 'default'
            }
        })
    else:
        for c in cats:
            items.append({
                'spec': {
                    'displayName': c.name,
                    'slug': c.slug or str(c.id),
                    'description': c.description or '',
                    'cover': c.thumbnail or '',
                    'priority': c.priority or 0
                },
                'status': {
                    'permalink': f'/categories/{c.slug or c.id}'
                },
                'metadata': {
                    'name': c.name
                }
            })

    return jsonify({'items': items})


@api_halo.route('/apis/content.halo.run/v1alpha1/categories', methods=['POST'])
@halo_auth_required
def halo_create_category():
    """按需创建新分类"""
    data = request.get_json() or {}
    spec = data.get('spec', {})
    display_name = (spec.get('displayName') or '').strip()
    slug = (spec.get('slug') or '').strip()

    if not display_name:
        display_name = '未命名分类'
    if not slug:
        slug = re.sub(r'[^a-zA-Z0-9]', '', display_name).lower() or f"cat-{int(datetime.now().timestamp())}"

    cat = Categories.query.filter(Categories.name == display_name, Categories.deleted == 0).first()
    if not cat:
        cat = Categories(
            name=display_name,
            slug=slug,
            description=spec.get('description', ''),
            color='#3b82f6',
            parent_id=0,
            deleted=0,
            create_time=datetime.now(),
            update_time=datetime.now()
        )
        db.session.add(cat)
        db.session.commit()

    return jsonify({
        'apiVersion': 'content.halo.run/v1alpha1',
        'kind': 'Category',
        'metadata': {
            'name': cat.name
        },
        'spec': {
            'displayName': cat.name,
            'slug': cat.slug
        }
    })


# ──────────────────────────────────────────────
# 2. 标签 (Tags)
# ──────────────────────────────────────────────

@api_halo.route('/apis/content.halo.run/v1alpha1/tags', methods=['GET'])
@halo_auth_required
def halo_get_tags():
    """获取所有标签"""
    tags = Tags.query.filter(Tags.deleted == 0).order_by(Tags.id.asc()).all()
    items = []
    for t in tags:
        items.append({
            'spec': {
                'displayName': t.name,
                'slug': t.slug or str(t.id),
                'color': t.color or '#10b981',
                'cover': ''
            },
            'metadata': {
                'name': t.name
            }
        })
    return jsonify({'items': items})


@api_halo.route('/apis/content.halo.run/v1alpha1/tags', methods=['POST'])
@halo_auth_required
def halo_create_tag():
    """按需创建新标签"""
    data = request.get_json() or {}
    spec = data.get('spec', {})
    display_name = (spec.get('displayName') or '').strip()
    slug = (spec.get('slug') or '').strip()

    if not display_name:
        display_name = '新标签'
    if not slug:
        slug = re.sub(r'[^a-zA-Z0-9]', '', display_name).lower() or f"tag-{int(datetime.now().timestamp())}"

    tag = Tags.query.filter(Tags.name == display_name, Tags.deleted == 0).first()
    if not tag:
        tag = Tags(
            name=display_name,
            slug=slug,
            slug_name=display_name,
            color=spec.get('color', '#10b981'),
            deleted=0,
            create_time=datetime.now(),
            update_time=datetime.now()
        )
        db.session.add(tag)
        db.session.commit()

    return jsonify({
        'apiVersion': 'content.halo.run/v1alpha1',
        'kind': 'Tag',
        'metadata': {
            'name': tag.name
        },
        'spec': {
            'displayName': tag.name,
            'slug': tag.slug
        }
    })


# ──────────────────────────────────────────────
# 3. 文章发布与管理 (Posts)
# ──────────────────────────────────────────────

def _sync_halo_taxonomy(post_id: int, cat_names: list, tag_names: list):
    """同步文章的分类与标签"""
    now = datetime.now()
    if cat_names:
        c_name = cat_names[0].strip()
        cat = Categories.query.filter(Categories.name == c_name, Categories.deleted == 0).first()
        if not cat:
            slug = re.sub(r'[^a-zA-Z0-9]', '', c_name).lower() or f"cat-{int(now.timestamp())}"
            cat = Categories(name=c_name, slug=slug, description='', color='#3b82f6', parent_id=0, deleted=0, create_time=now, update_time=now)
            db.session.add(cat)
            db.session.flush()

        pc = PostCategories.query.filter(PostCategories.post_id == post_id).first()
        if pc:
            pc.category_id = cat.id
            pc.deleted = 0
            pc.update_time = now
        else:
            db.session.add(PostCategories(post_id=post_id, category_id=cat.id, deleted=0, create_time=now, update_time=now))

    if tag_names:
        PostTags.query.filter(PostTags.post_id == post_id).update({PostTags.deleted: 1})
        for t_name in tag_names:
            t_name = t_name.strip()
            if not t_name:
                continue
            t = Tags.query.filter(Tags.name == t_name, Tags.deleted == 0).first()
            if not t:
                slug = re.sub(r'[^a-zA-Z0-9]', '', t_name).lower() or f"tag-{int(now.timestamp())}"
                t = Tags(name=t_name, slug=slug, slug_name=t_name, color='#10b981', deleted=0, create_time=now, update_time=now)
                db.session.add(t)
                db.session.flush()

            pt = PostTags.query.filter(PostTags.post_id == post_id, PostTags.tag_id == t.id).first()
            if pt:
                pt.deleted = 0
                pt.update_time = now
            else:
                db.session.add(PostTags(post_id=post_id, tag_id=t.id, deleted=0, create_time=now, update_time=now))


@api_halo.route('/apis/api.console.halo.run/v1alpha1/posts', methods=['POST'])
@halo_auth_required
def halo_new_post():
    """新建文章（思源草稿/发布第一步）"""
    data = request.get_json() or {}
    post_obj = data.get('post', {})
    spec = post_obj.get('spec', {})
    metadata = post_obj.get('metadata', {})
    content_obj = data.get('content', {})

    title = spec.get('title') or '无标题文章'
    name_id = metadata.get('name') or uuid.uuid4().hex[:12]
    raw_content = content_obj.get('raw') or content_obj.get('content') or ''
    summary = spec.get('excerpt', {}).get('raw') or ''
    cover = spec.get('cover') or None

    now = datetime.now()

    # 检查 source_id 是否已存在
    p = Posts.query.filter(Posts.source_id == name_id, Posts.deleted == 0).first()
    if not p:
        p = Posts(
            title=title,
            author='admin',
            content=raw_content,
            access_count=0,
            thumbnail=cover,
            status=0,
            summary=summary,
            source_id=name_id,
            deleted=0,
            create_time=now,
            update_time=now
        )
        db.session.add(p)
        db.session.flush()
    else:
        p.title = title
        p.content = raw_content
        p.summary = summary
        p.update_time = now

    _sync_halo_taxonomy(p.id, spec.get('categories', []), spec.get('tags', []))
    db.session.commit()

    return jsonify({
        'apiVersion': 'content.halo.run/v1alpha1',
        'kind': 'Post',
        'metadata': {
            'name': name_id
        },
        'spec': {
            'title': p.title,
            'slug': str(p.id)
        }
    }), 200


@api_halo.route('/apis/api.console.halo.run/v1alpha1/posts/<path:post_name>/publish', methods=['PUT'])
@halo_auth_required
def halo_publish_post(post_name):
    """思源笔记发布第二步：正式发布文章"""
    p = Posts.query.filter(Posts.source_id == post_name, Posts.deleted == 0).first()
    if p:
        p.status = 0
        p.update_time = datetime.now()
        db.session.commit()
    return jsonify({'status': 'published'}), 200


@api_halo.route('/apis/content.halo.run/v1alpha1/posts/<path:post_name>', methods=['GET'])
@halo_auth_required
def halo_get_post(post_name):
    """获取文章元信息（用于二次修改编辑）"""
    p = Posts.query.filter(Posts.source_id == post_name, Posts.deleted == 0).first()
    if not p and post_name.isdigit():
        p = Posts.query.filter(Posts.id == int(post_name), Posts.deleted == 0).first()

    if not p:
        return jsonify({'title': 'Not Found', 'status': 404, 'detail': '文章不存在'}), 404

    # 获取关联分类与标签
    cats = [c.name for c in Categories.query.join(PostCategories, Categories.id == PostCategories.category_id).filter(PostCategories.post_id == p.id, PostCategories.deleted == 0).all()]
    tags = [t.name for t in Tags.query.join(PostTags, Tags.id == PostTags.tag_id).filter(PostTags.post_id == p.id, PostTags.deleted == 0).all()]

    return jsonify({
        'post': {
            'metadata': {
                'name': p.source_id or str(p.id)
            },
            'spec': {
                'title': p.title,
                'slug': str(p.id),
                'excerpt': {
                    'raw': p.summary or ''
                },
                'categories': cats,
                'tags': tags,
                'cover': p.thumbnail or ''
            }
        }
    })


@api_halo.route('/apis/api.console.halo.run/v1alpha1/posts/<path:post_name>/head-content', methods=['GET'])
@halo_auth_required
def halo_get_post_content(post_name):
    """获取文章原始内容"""
    p = Posts.query.filter(Posts.source_id == post_name, Posts.deleted == 0).first()
    if not p and post_name.isdigit():
        p = Posts.query.filter(Posts.id == int(post_name), Posts.deleted == 0).first()

    if not p:
        return jsonify({'title': 'Not Found', 'status': 404}), 404

    return jsonify({
        'raw': p.content or '',
        'content': p.content or '',
        'rawType': 'markdown'
    })


@api_halo.route('/apis/content.halo.run/v1alpha1/posts/<path:post_name>', methods=['PUT'])
@halo_auth_required
def halo_update_post_meta(post_name):
    """更新文章元信息"""
    data = request.get_json() or {}
    spec = data.get('spec', {})
    p = Posts.query.filter(Posts.source_id == post_name, Posts.deleted == 0).first()
    if p:
        if spec.get('title'):
            p.title = spec['title']
        if spec.get('excerpt', {}).get('raw'):
            p.summary = spec['excerpt']['raw']
        p.update_time = datetime.now()
        _sync_halo_taxonomy(p.id, spec.get('categories', []), spec.get('tags', []))
        db.session.commit()
    return jsonify({'status': 'ok'})


@api_halo.route('/apis/api.console.halo.run/v1alpha1/posts/<path:post_name>/content', methods=['PUT'])
@halo_auth_required
def halo_update_post_content(post_name):
    """更新文章正文内容"""
    data = request.get_json() or {}
    raw = data.get('raw') or data.get('content') or ''
    p = Posts.query.filter(Posts.source_id == post_name, Posts.deleted == 0).first()
    if p and raw:
        p.content = raw
        p.update_time = datetime.now()
        db.session.commit()
    return jsonify({'status': 'ok'})


@api_halo.route('/apis/api.console.halo.run/v1alpha1/posts/<path:post_name>/recycle', methods=['PUT'])
@halo_auth_required
def halo_recycle_post(post_name):
    """删除/移入回收站"""
    p = Posts.query.filter(Posts.source_id == post_name, Posts.deleted == 0).first()
    if p:
        p.deleted = 1
        p.update_time = datetime.now()
        db.session.commit()
    return jsonify({'status': 'ok', 'metadata': {'name': post_name}})


# ──────────────────────────────────────────────
# 4. 附件/图片上传 (Attachments)
# ──────────────────────────────────────────────

HALO_ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

@api_halo.route('/apis/api.console.halo.run/v1alpha1/attachments/upload', methods=['POST'])
@halo_auth_required
def halo_upload_attachment():
    """思源笔记内嵌图片上传自动转存（实施严格文件扩展名白名单防范任意文件上传与 XSS）"""
    if 'file' not in request.files:
        return jsonify({'title': 'No file', 'status': 400}), 400

    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'title': 'Invalid file', 'status': 400}), 400

    orig_name = file.filename
    if '.' not in orig_name:
        return jsonify({'title': 'Invalid file extension', 'status': 400, 'detail': '上传文件必须包含合法扩展名'}), 400

    ext = orig_name.rsplit('.', 1)[1].lower()
    if ext not in HALO_ALLOWED_EXTENSIONS:
        return jsonify({
            'title': 'Unsupported Media Type',
            'status': 400,
            'detail': f'安全拦截：仅支持图片格式文件上传 ({", ".join(sorted(HALO_ALLOWED_EXTENSIONS))})'
        }), 400

    now = datetime.now()
    year_month = now.strftime('%Y%m')
    save_dir = Path(config.UPLOAD_PATH) / 'images' / year_month
    save_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{now.strftime('%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
    target_path = save_dir / unique_name
    file.save(str(target_path))

    file_url = f"/uploads/images/{year_month}/{unique_name}"

    # 登记入库
    img_rec = OssImage(
        url=file_url,
        file_name=orig_name,
        remark='思源笔记同步上传',
        deleted=0,
        create_time=now,
        update_time=now
    )
    db.session.add(img_rec)
    db.session.commit()

    return jsonify({
        'metadata': {
            'name': str(img_rec.id),
            'annotations': {
                'storage.halo.run/uri': file_url
            }
        },
        'spec': {
            'displayName': orig_name
        }
    })
