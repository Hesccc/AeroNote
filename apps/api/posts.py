from flask import Blueprint, request, jsonify, g
from datetime import datetime
import collections
import zipfile
import io
import os
from sqlalchemy import func
from apps.exts import db
from apps.models.model import Posts, Categories, Tags, PostTags, PostCategories
from apps.tools.tools import escape_like
from apps.tools.cache import (
    api_cache,
    invalidate_posts_cache,
    invalidate_taxonomy_cache,
    invalidate_all_cache
)
from .middleware import token_required

api_posts = Blueprint('api_posts', __name__)


def serialize_posts(posts, include_content=False):
    """
    批量序列化文章列表，消除 N+1 查询瓶颈。
    无论列表文章数量多少，始终只执行 2 次批量查询获取关联分类与标签。
    include_content=False 时（列表模式），正文仅保留前 200 字符，并将响应体积从几百KB缩减至几KB。
    """
    if not posts:
        return []

    post_ids = [p.id for p in posts]

    # 1. 单次批量查询分类关联
    cat_rows = (
        db.session.query(PostCategories.post_id, Categories)
        .join(Categories, Categories.id == PostCategories.category_id)
        .filter(
            PostCategories.post_id.in_(post_ids),
            PostCategories.deleted == 0,
            Categories.deleted == 0
        )
        .all()
    )
    categories_by_post = collections.defaultdict(list)
    for post_id, c in cat_rows:
        categories_by_post[post_id].append({
            'id': c.id,
            'name': c.name,
            'slug': c.slug,
            'color': c.color
        })

    # 2. 单次批量查询标签关联
    tag_rows = (
        db.session.query(PostTags.post_id, Tags)
        .join(Tags, Tags.id == PostTags.tag_id)
        .filter(
            PostTags.post_id.in_(post_ids),
            PostTags.deleted == 0,
            Tags.deleted == 0
        )
        .all()
    )
    tags_by_post = collections.defaultdict(list)
    for post_id, t in tag_rows:
        tags_by_post[post_id].append({
            'id': t.id,
            'name': t.name,
            'slug': t.slug,
            'color': t.color
        })

    # 3. 内存聚合生成序列化对象
    results = []
    for post in posts:
        raw_content = post.content or ''
        word_count = len(raw_content) // 2
        # summary 优先展示 summary 字段，为空时降级 meta_description
        article_summary = post.summary or post.meta_description or (raw_content[:150] if raw_content else '')
        # 列表模式下不返回几十KB/几百KB的完整Markdown正文，仅保留前200字符作为降级兜底
        res_content = raw_content if include_content else (raw_content[:200] if raw_content else '')
        results.append({
            'id': post.id,
            'title': post.title,
            'author': post.author,
            'content': res_content,
            'word_count': word_count,
            'access_count': post.access_count,
            'thumbnail': post.thumbnail,
            'status': post.status,
            'create_time': post.create_time.isoformat() if post.create_time else None,
            'update_time': post.update_time.isoformat() if post.update_time else None,
            'meta_description': post.meta_description,
            'summary': article_summary,
            'categories': categories_by_post.get(post.id, []),
            'tags': tags_by_post.get(post.id, [])
        })
    return results


def serialize_post(post):
    """单个文章序列化（详情页调用，必须包含完整正文内容）。"""
    if not post:
        return None
    res = serialize_posts([post], include_content=True)
    return res[0] if res else None

# ----------------- PUBLIC ENDPOINTS -----------------

@api_posts.route('/api/posts', methods=['GET'])
def get_posts():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    category_slug = request.args.get('category')
    tag_slug = request.args.get('tag')
    search = request.args.get('search')

    # 高频读接口内存缓存 (Task 4)
    cache_key = f"posts:p={page}&pp={per_page}&c={category_slug or ''}&t={tag_slug or ''}&s={search or ''}"
    cached_data = api_cache.get(cache_key)
    if cached_data is not None:
        resp = jsonify(cached_data)
        resp.headers['X-Cache'] = 'HIT'
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp
    
    query = Posts.query.filter(Posts.deleted == 0, Posts.status == 0)
    
    if category_slug:
        query = query.join(PostCategories, Posts.id == PostCategories.post_id)\
                     .join(Categories, Categories.id == PostCategories.category_id)\
                     .filter(Categories.slug == category_slug, PostCategories.deleted == 0, Categories.deleted == 0)
                     
    if tag_slug:
        query = query.join(PostTags, Posts.id == PostTags.post_id)\
                     .join(Tags, Tags.id == PostTags.tag_id)\
                     .filter(Tags.slug == tag_slug, PostTags.deleted == 0, Tags.deleted == 0)
                     
    if search:
        safe_search = escape_like(search)
        query = query.filter(Posts.title.like(f'%{safe_search}%') | Posts.content.like(f'%{safe_search}%'))
        
    # Order by create_time descending, and secondary order by id descending to ensure stable pagination
    query = query.order_by(Posts.create_time.desc(), Posts.id.desc())
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    result_data = {
        'posts': serialize_posts(pagination.items),
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev
    }

    # 写入缓存并下发 60s 缓存控制头
    api_cache.set(cache_key, result_data, ttl=60)
    resp = jsonify(result_data)
    resp.headers['X-Cache'] = 'MISS'
    resp.headers['Cache-Control'] = 'public, max-age=60'
    return resp

@api_posts.route('/api/posts/<int:post_id>', methods=['GET'])
def get_post_detail(post_id):
    post = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0, Posts.status == 0).first_or_404()
    
    # 原子自增阅读量，杜绝高并发并发丢失更新 (Lost Update)
    Posts.query.filter(Posts.id == post.id).update({
        Posts.access_count: func.coalesce(Posts.access_count, 0) + 1
    })
    db.session.commit()
    # 内存对象同步自增
    post.access_count = (post.access_count or 0) + 1
    
    data = serialize_post(post)

    # 1. 查找上一篇与下一篇 (按发布时间与主键确定性排序)
    # prev: 比当前文章更早（时间更小或同时间id更小）
    prev_post = Posts.query.filter(
        Posts.deleted == 0,
        Posts.status == 0,
        (Posts.create_time < post.create_time) | 
        ((Posts.create_time == post.create_time) & (Posts.id < post.id))
    ).order_by(Posts.create_time.desc(), Posts.id.desc()).first()

    # next: 比当前文章更新（时间更大或同时间id更大）
    next_post = Posts.query.filter(
        Posts.deleted == 0,
        Posts.status == 0,
        (Posts.create_time > post.create_time) | 
        ((Posts.create_time == post.create_time) & (Posts.id > post.id))
    ).order_by(Posts.create_time.asc(), Posts.id.asc()).first()

    data['prev_post'] = {
        'id': prev_post.id,
        'title': prev_post.title,
        'thumbnail': prev_post.thumbnail
    } if prev_post else None

    data['next_post'] = {
        'id': next_post.id,
        'title': next_post.title,
        'thumbnail': next_post.thumbnail
    } if next_post else None

    # 2. 相关推荐 (优先同分类，其次同标签，排除自身，最多 4 篇)
    category_ids = [c['id'] for c in data.get('categories', [])]
    tag_ids = [t['id'] for t in data.get('tags', [])]
    
    related_posts_map = {}

    # 同分类推荐
    if category_ids:
        matched_by_cat = db.session.query(Posts).join(
            PostCategories, Posts.id == PostCategories.post_id
        ).filter(
            PostCategories.category_id.in_(category_ids),
            PostCategories.deleted == 0,
            Posts.id != post.id,
            Posts.deleted == 0,
            Posts.status == 0
        ).order_by(Posts.create_time.desc(), Posts.id.desc()).limit(6).all()
        for p in matched_by_cat:
            related_posts_map[p.id] = p

    # 同标签推荐
    if len(related_posts_map) < 4 and tag_ids:
        matched_by_tag = db.session.query(Posts).join(
            PostTags, Posts.id == PostTags.post_id
        ).filter(
            PostTags.tag_id.in_(tag_ids),
            PostTags.deleted == 0,
            Posts.id != post.id,
            Posts.deleted == 0,
            Posts.status == 0
        ).order_by(Posts.create_time.desc(), Posts.id.desc()).limit(6).all()
        for p in matched_by_tag:
            related_posts_map[p.id] = p

    # 若仍不足 4 篇，兜底补充最新发布的其他文章
    if len(related_posts_map) < 4:
        recent_posts = Posts.query.filter(
            Posts.id != post.id,
            Posts.deleted == 0,
            Posts.status == 0
        ).order_by(Posts.create_time.desc(), Posts.id.desc()).limit(6).all()
        for p in recent_posts:
            if p.id not in related_posts_map:
                related_posts_map[p.id] = p
            if len(related_posts_map) >= 4:
                break

    related_list = list(related_posts_map.values())[:4]
    data['related_posts'] = serialize_posts(related_list)
    
    return jsonify(data)

@api_posts.route('/api/categories', methods=['GET'])
def get_categories():
    cached = api_cache.get('categories:all')
    if cached is not None:
        resp = jsonify(cached)
        resp.headers['X-Cache'] = 'HIT'
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp

    categories = Categories.query.filter(Categories.deleted == 0).order_by(Categories.priority.desc(), Categories.id.asc()).all()
    data = [{
        'id': c.id,
        'name': c.name,
        'slug': c.slug,
        'description': c.description,
        'color': c.color,
        'parent_id': c.parent_id,
        'priority': c.priority or 0
    } for c in categories]
    api_cache.set('categories:all', data, ttl=60)
    resp = jsonify(data)
    resp.headers['X-Cache'] = 'MISS'
    resp.headers['Cache-Control'] = 'public, max-age=60'
    return resp

@api_posts.route('/api/tags', methods=['GET'])
def get_tags():
    cached = api_cache.get('tags:all')
    if cached is not None:
        resp = jsonify(cached)
        resp.headers['X-Cache'] = 'HIT'
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp

    tags = Tags.query.filter(Tags.deleted == 0).order_by(Tags.id.asc()).all()
    data = [{
        'id': t.id,
        'name': t.name,
        'slug': t.slug,
        'color': t.color
    } for t in tags]
    api_cache.set('tags:all', data, ttl=60)
    resp = jsonify(data)
    resp.headers['X-Cache'] = 'MISS'
    resp.headers['Cache-Control'] = 'public, max-age=60'
    return resp

# ----------------- ADMIN ENDPOINTS -----------------

@api_posts.route('/api/manage/posts', methods=['GET'])
@token_required
def manage_get_posts():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search')
    status = request.args.get('status', type=int)
    category_id = request.args.get('category_id', type=int)
    sort_by = request.args.get('sort_by', 'create_time')   # field name
    sort_order = request.args.get('sort_order', 'desc')     # asc | desc

    # Clamp per_page to sane values (支持 20, 50, 100, 200)
    per_page = max(5, min(per_page, 200))

    # Allowed sort columns (map frontend key -> model attr)
    SORT_MAP = {
        'id': Posts.id,
        'title': Posts.title,
        'access_count': Posts.access_count,
        'status': Posts.status,
        'create_time': Posts.create_time,
        'update_time': Posts.update_time,
    }
    sort_col = SORT_MAP.get(sort_by, Posts.create_time)
    order_expr = sort_col.asc() if sort_order == 'asc' else sort_col.desc()

    query = Posts.query.filter(Posts.deleted == 0)

    # 状态过滤 (0: 已发布, 3: 草稿)
    if status is not None:
        query = query.filter(Posts.status == status)

    # 分类过滤
    if category_id:
        query = query.join(PostCategories, Posts.id == PostCategories.post_id)\
                     .filter(PostCategories.category_id == category_id, PostCategories.deleted == 0)

    if search:
        safe_search = escape_like(search)
        query = query.filter(Posts.title.like(f'%{safe_search}%'))

    query = query.order_by(order_expr)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'posts': serialize_posts(pagination.items),
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'per_page': per_page,
        'sort_by': sort_by,
        'sort_order': sort_order,
    })

@api_posts.route('/api/manage/posts/<int:post_id>', methods=['GET'])
@token_required
def manage_get_post_detail(post_id):
    post = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first_or_404()
    return jsonify(serialize_post(post))

@api_posts.route('/api/manage/posts', methods=['POST'])
@token_required
def manage_create_post():
    data = request.get_json() or {}
    title = data.get('title')
    content = data.get('content', '')
    status = data.get('status', 0)  # 0: published, 3: draft
    category_id = data.get('category_id')
    tag_ids = data.get('tag_ids', [])
    thumbnail = data.get('thumbnail')
    meta_description = data.get('meta_description')
    summary = data.get('summary')
    
    if not title:
        return jsonify({'msg': 'Title is required!'}), 400
        
    new_post = Posts(
        title=title,
        content=content,
        author=g.current_user.username,
        access_count=0,
        thumbnail=thumbnail,
        status=status,
        meta_description=meta_description or (content[:150] if content else ''),
        summary=summary or (meta_description or (content[:150] if content else '')),
        deleted=0,
        create_time=datetime.now(),
        update_time=datetime.now()
    )
    db.session.add(new_post)
    db.session.flush()  # Generates new_post.id
    
    if category_id:
        post_cat = PostCategories(post_id=new_post.id, category_id=category_id, deleted=0, create_time=datetime.now(), update_time=datetime.now())
        db.session.add(post_cat)
        
    if tag_ids:
        for tag_id in tag_ids:
            post_tag = PostTags(post_id=new_post.id, tag_id=tag_id, deleted=0, create_time=datetime.now(), update_time=datetime.now())
            db.session.add(post_tag)
            
    db.session.commit()
    invalidate_all_cache()
    return jsonify(serialize_post(new_post)), 201

@api_posts.route('/api/manage/posts/<int:post_id>', methods=['PUT'])
@token_required
def manage_update_post(post_id):
    post = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first_or_404()
    
    data = request.get_json() or {}
    title = data.get('title')
    content = data.get('content')
    status = data.get('status')
    category_id = data.get('category_id')
    tag_ids = data.get('tag_ids')
    _SENTINEL = object()
    thumbnail = data.get('thumbnail', _SENTINEL)
    meta_description = data.get('meta_description')
    
    if title is not None:
        post.title = title
    if content is not None:
        post.content = content
        if meta_description is None:
            post.meta_description = content[:150]
    if status is not None:
        post.status = status
    # thumbnail 字段：传字符串则更新，传 null 则清空，不传则不修改
    if thumbnail is not _SENTINEL:
        post.thumbnail = thumbnail  # None 也合法，代表清空
    if meta_description is not None:
        post.meta_description = meta_description
    if 'summary' in data:
        post.summary = data.get('summary')
        
    post.update_time = datetime.now()
    
    # Update category relations
    if category_id is not None:
        # Delete old category relations
        PostCategories.query.filter(PostCategories.post_id == post.id).delete()
        if category_id:
            post_cat = PostCategories(post_id=post.id, category_id=category_id, deleted=0, create_time=datetime.now(), update_time=datetime.now())
            db.session.add(post_cat)
            
    # Update tag relations
    if tag_ids is not None:
        # Delete old tag relations
        PostTags.query.filter(PostTags.post_id == post.id).delete()
        for tag_id in tag_ids:
            post_tag = PostTags(post_id=post.id, tag_id=tag_id, deleted=0, create_time=datetime.now(), update_time=datetime.now())
            db.session.add(post_tag)
            
    db.session.commit()
    invalidate_all_cache()
    return jsonify(serialize_post(post))

@api_posts.route('/api/manage/posts/<int:post_id>', methods=['DELETE'])
@token_required
def manage_delete_post(post_id):
    post = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first_or_404()
    post.deleted = 1
    post.update_time = datetime.now()
    
    # Also soft delete relations
    PostCategories.query.filter(PostCategories.post_id == post_id).update({PostCategories.deleted: 1})
    PostTags.query.filter(PostTags.post_id == post_id).update({PostTags.deleted: 1})
    
    db.session.commit()
    invalidate_all_cache()
    return jsonify({'msg': 'Post deleted successfully!'})


# ----------------- BATCH OPERATIONS -----------------

@api_posts.route('/api/manage/posts/batch', methods=['POST'])
@token_required
def manage_batch_posts():
    """
    Batch operations on posts.
    Body: { "action": "delete"|"publish"|"draft", "ids": [1, 2, 3] }
    Returns: { "msg": str, "affected": int }
    """
    data = request.get_json() or {}
    action = data.get('action')
    ids = data.get('ids', [])

    if not action or action not in ('delete', 'publish', 'draft'):
        return jsonify({'msg': 'action 参数无效，可选值：delete / publish / draft'}), 400
    if not ids or not isinstance(ids, list):
        return jsonify({'msg': 'ids 参数无效，请传入文章 ID 列表'}), 400

    posts = Posts.query.filter(Posts.id.in_(ids), Posts.deleted == 0).all()
    if not posts:
        return jsonify({'msg': '未找到目标文章'}), 404

    now = datetime.now()
    for post in posts:
        if action == 'delete':
            post.deleted = 1
            post.update_time = now
            PostCategories.query.filter(PostCategories.post_id == post.id).update({PostCategories.deleted: 1})
            PostTags.query.filter(PostTags.post_id == post.id).update({PostTags.deleted: 1})
        elif action == 'publish':
            post.status = 0
            post.update_time = now
        elif action == 'draft':
            post.status = 3
            post.update_time = now

    db.session.commit()
    invalidate_all_cache()
    action_label = {'delete': '删除', 'publish': '发布', 'draft': '设为草稿'}[action]
    return jsonify({'msg': f'已{action_label} {len(posts)} 篇文章', 'affected': len(posts)})


# ----------------- IMPORT POSTS -----------------


def _parse_md_frontmatter(text: str):
    """
    Parse optional YAML-like frontmatter from a .md file.
    Returns (title, status, body_content).
    Frontmatter block is delimited by --- lines at the top.
    Supported keys: title, status (published|draft|0|3)
    """
    title = None
    status = 3  # default to draft

    lines = text.splitlines()
    if lines and lines[0].strip() == '---':
        end_idx = None
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == '---':
                end_idx = i
                break
        if end_idx:
            fm_lines = lines[1:end_idx]
            body_lines = lines[end_idx + 1:]
            for fl in fm_lines:
                if ':' in fl:
                    key, _, val = fl.partition(':')
                    key = key.strip().lower()
                    val = val.strip().strip('"').strip("'")
                    if key == 'title':
                        title = val
                    elif key == 'status':
                        if val in ('0', 'published', 'publish'):
                            status = 0
                        else:
                            status = 3
            return title, status, '\n'.join(body_lines).strip()

    return title, status, text.strip()


def _import_single_md(filename: str, content_bytes: bytes, author: str):
    """
    Parse and save a single .md file as a Post.
    Returns the created Post object or raises on error.
    """
    text = content_bytes.decode('utf-8', errors='replace')
    title, status, body = _parse_md_frontmatter(text)

    # Fall back title to file name (strip .md extension)
    if not title:
        base = os.path.basename(filename)
        title = os.path.splitext(base)[0].replace('-', ' ').replace('_', ' ').strip()
    if not title:
        title = '未命名文章'

    new_post = Posts(
        title=title,
        content=body,
        author=author,
        access_count=0,
        thumbnail=None,
        status=status,
        meta_description=(body[:150] if body else ''),
        deleted=0,
        create_time=datetime.now(),
        update_time=datetime.now()
    )
    db.session.add(new_post)
    return new_post


@api_posts.route('/api/manage/posts/import', methods=['POST'])
@token_required
def manage_import_posts():
    """
    Import posts from uploaded files.
    Accepts:
      - A single .md file  (field: file)
      - A .zip archive containing .md files (field: file)
    Returns a JSON summary: { imported: int, skipped: int, titles: [str], errors: [str] }
    """
    if 'file' not in request.files:
        return jsonify({'msg': '请上传文件（file 字段）'}), 400

    upload = request.files['file']
    filename = upload.filename or ''
    author = g.current_user.username

    imported_titles = []
    skipped = []
    errors = []

    try:
        if filename.lower().endswith('.md'):
            # Single markdown file
            content_bytes = upload.read()
            try:
                post = _import_single_md(filename, content_bytes, author)
                db.session.flush()
                imported_titles.append(post.title)
            except Exception as e:
                errors.append(f'{filename}: {str(e)}')

        elif filename.lower().endswith('.zip'):
            # ZIP archive — extract all .md files
            content_bytes = upload.read()
            try:
                zf = zipfile.ZipFile(io.BytesIO(content_bytes))
            except zipfile.BadZipFile:
                return jsonify({'msg': '无效的 ZIP 文件'}), 400

            md_names = [n for n in zf.namelist() if n.lower().endswith('.md') and not os.path.basename(n).startswith('.')]
            if not md_names:
                return jsonify({'msg': 'ZIP 压缩包中未找到 .md 文件'}), 400

            for md_name in md_names:
                try:
                    md_bytes = zf.read(md_name)
                    post = _import_single_md(md_name, md_bytes, author)
                    db.session.flush()
                    imported_titles.append(post.title)
                except Exception as e:
                    errors.append(f'{md_name}: {str(e)}')
                    skipped.append(md_name)

        else:
            return jsonify({'msg': '仅支持 .md 文件或 .zip 压缩包'}), 400

        db.session.commit()
        invalidate_all_cache()

    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': f'导入失败：{str(e)}'}), 500

    return jsonify({
        'msg': f'成功导入 {len(imported_titles)} 篇文章',
        'imported': len(imported_titles),
        'skipped': len(skipped),
        'titles': imported_titles,
        'errors': errors
    })



# ----------------- CATEGORY & TAG MANAGEMENT -----------------

@api_posts.route('/api/manage/categories', methods=['POST'])
@token_required
def manage_create_category():
    data = request.get_json() or {}
    name = data.get('name')
    slug = data.get('slug')
    description = data.get('description', '')
    color = data.get('color', '#41baff')
    parent_id = data.get('parent_id', 0)
    priority = data.get('priority', 0)
    
    if not name or not slug:
        return jsonify({'msg': 'Name and slug are required!'}), 400
        
    # Check if slug exists
    exists = Categories.query.filter(Categories.slug == slug, Categories.deleted == 0).first()
    if exists:
        return jsonify({'msg': 'Category slug already exists!'}), 400
        
    try:
        priority_val = int(priority) if priority is not None else 0
    except (ValueError, TypeError):
        priority_val = 0

    cat = Categories(
        name=name,
        slug=slug,
        description=description,
        color=color,
        parent_id=parent_id,
        priority=priority_val,
        deleted=0,
        create_time=datetime.now(),
        update_time=datetime.now()
    )
    db.session.add(cat)
    db.session.commit()
    invalidate_taxonomy_cache()
    return jsonify({
        'id': cat.id,
        'name': cat.name,
        'slug': cat.slug,
        'description': cat.description,
        'color': cat.color,
        'parent_id': cat.parent_id,
        'priority': cat.priority or 0
    }), 201

@api_posts.route('/api/manage/categories/<int:cat_id>', methods=['PUT'])
@token_required
def manage_update_category(cat_id):
    cat = Categories.query.filter(Categories.id == cat_id, Categories.deleted == 0).first_or_404()
    data = request.get_json() or {}
    name = data.get('name')
    slug = data.get('slug')
    description = data.get('description')
    color = data.get('color')
    parent_id = data.get('parent_id')
    
    if name is not None:
        cat.name = name
    if slug is not None:
        # Check slug uniqueness
        exists = Categories.query.filter(Categories.slug == slug, Categories.id != cat_id, Categories.deleted == 0).first()
        if exists:
            return jsonify({'msg': 'Category slug already exists!'}), 400
        cat.slug = slug
    if description is not None:
        cat.description = description
    if color is not None:
        cat.color = color
    if parent_id is not None:
        cat.parent_id = parent_id
    if 'priority' in data:
        try:
            cat.priority = int(data['priority']) if data['priority'] is not None else 0
        except (ValueError, TypeError):
            cat.priority = 0
        
    cat.update_time = datetime.now()
    db.session.commit()
    invalidate_taxonomy_cache()
    return jsonify({
        'id': cat.id,
        'name': cat.name,
        'slug': cat.slug,
        'description': cat.description,
        'color': cat.color,
        'parent_id': cat.parent_id,
        'priority': cat.priority or 0
    })

@api_posts.route('/api/manage/categories/<int:cat_id>', methods=['DELETE'])
@token_required
def manage_delete_category(cat_id):
    cat = Categories.query.filter(Categories.id == cat_id, Categories.deleted == 0).first_or_404()
    cat.deleted = 1
    cat.update_time = datetime.now()
    PostCategories.query.filter(PostCategories.category_id == cat_id).update({PostCategories.deleted: 1})
    db.session.commit()
    invalidate_taxonomy_cache()
    return jsonify({'msg': 'Category deleted successfully!'})

@api_posts.route('/api/manage/tags', methods=['POST'])
@token_required
def manage_create_tag():
    data = request.get_json() or {}
    name = data.get('name')
    slug = data.get('slug')
    color = data.get('color', '#41baff')
    
    if not name or not slug:
        return jsonify({'msg': 'Name and slug are required!'}), 400
        
    # Check if slug exists
    exists = Tags.query.filter(Tags.slug == slug, Tags.deleted == 0).first()
    if exists:
        return jsonify({'msg': 'Tag slug already exists!'}), 400
        
    tag = Tags(
        name=name,
        slug=slug,
        color=color,
        deleted=0,
        create_time=datetime.now(),
        update_time=datetime.now()
    )
    db.session.add(tag)
    db.session.commit()
    invalidate_taxonomy_cache()
    return jsonify({
        'id': tag.id,
        'name': tag.name,
        'slug': tag.slug,
        'color': tag.color
    }), 201

@api_posts.route('/api/manage/tags/<int:tag_id>', methods=['PUT'])
@token_required
def manage_update_tag(tag_id):
    tag = Tags.query.filter(Tags.id == tag_id, Tags.deleted == 0).first_or_404()
    data = request.get_json() or {}
    name = data.get('name')
    slug = data.get('slug')
    color = data.get('color')
    
    if name is not None:
        tag.name = name
    if slug is not None:
        exists = Tags.query.filter(Tags.slug == slug, Tags.id != tag_id, Tags.deleted == 0).first()
        if exists:
            return jsonify({'msg': 'Tag slug already exists!'}), 400
        tag.slug = slug
    if color is not None:
        tag.color = color
        
    tag.update_time = datetime.now()
    db.session.commit()
    invalidate_taxonomy_cache()
    return jsonify({
        'id': tag.id,
        'name': tag.name,
        'slug': tag.slug,
        'color': tag.color
    })

@api_posts.route('/api/manage/tags/<int:tag_id>', methods=['DELETE'])
@token_required
def manage_delete_tag(tag_id):
    tag = Tags.query.filter(Tags.id == tag_id, Tags.deleted == 0).first_or_404()
    tag.deleted = 1
    tag.update_time = datetime.now()
    PostTags.query.filter(PostTags.tag_id == tag_id).update({PostTags.deleted: 1})
    db.session.commit()
    invalidate_taxonomy_cache()
    return jsonify({'msg': 'Tag deleted successfully!'})
