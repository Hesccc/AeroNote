"""
OSS 图片库 API
--------------
说明：不对接 OSS SDK，图片库为纯 URL 收藏夹。
管理员手动添加 OSS 图片 URL，系统在 DB 中维护索引，支持文章封面随机兜底。
"""
import random as _random
import uuid
import urllib.request
import hashlib
from pathlib import Path
from urllib.parse import urlparse, unquote
from datetime import datetime

from flask import Blueprint, request, jsonify, send_from_directory, redirect
from apps.exts import db
from apps.models.oss_image import OssImage
from apps.models.model import Posts
from apps import config
from apps.tools.tools import escape_like
from .middleware import token_required

api_oss = Blueprint('api_oss', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _parse_filename(url: str) -> str:
    """从 URL 路径中解析出文件名。"""
    try:
        path = urlparse(url).path
        return unquote(path.split('/')[-1]) or url
    except Exception:
        return url


# ──────────────────────────────────────────────
# 公开接口（无需登录）
# ──────────────────────────────────────────────

@api_oss.route('/api/oss/random', methods=['GET'])
def oss_random_image():
    """
    随机返回一张图片的 URL，供前端文章卡片兜底使用。
    从 DB 直接随机取，性能好，无需遍历 OSS。
    """
    count = OssImage.query.filter(OssImage.deleted == 0).count()
    if count == 0:
        return jsonify({'url': None})

    # 随机偏移取一条，比 ORDER BY RAND() 在大表时更高效
    offset = _random.randint(0, count - 1)
    img = OssImage.query.filter(OssImage.deleted == 0).offset(offset).limit(1).first()
    if img:
        return jsonify({'url': img.url, 'id': img.id})
    return jsonify({'url': None})


@api_oss.route('/api/posts/<int:post_id>/cover', methods=['GET'])
def get_post_deterministic_cover(post_id: int):
    """
    确定性免费图床缓存服务：
    1. 若文章已有 thumbnail，直接重定向到其 thumbnail；
    2. 若无，根据 post_id 生成唯一的确定性 Seed，检查 temp/images 目录是否已缓存；
    3. 若本地已有缓存，直接从本地返回静态图片（消除外部网络依赖）；
    4. 若未缓存，从高质量图站 (Picsum Photos) 拉取并保存到 temp/images/，再返回本地静态文件；
    5. 若离线或拉取失败，重定向到默认备用图或外部直连。
    """
    post = Posts.query.filter(Posts.id == post_id, Posts.deleted == 0).first()
    if post and post.thumbnail and post.thumbnail.strip():
        thumb_url = post.thumbnail.strip()
        parsed = urlparse(thumb_url)
        # 安全防御：防范开放重定向 (Open Redirect) 与 javascript: 等伪协议攻击
        if parsed.scheme in ('http', 'https') or thumb_url.startswith('/'):
            return redirect(thumb_url)

    # 构造唯一文件名：post_{post_id}_{seed_hash}.jpg
    seed = f"blog-article-{post_id}"
    seed_hash = hashlib.md5(seed.encode()).hexdigest()[:8]
    cached_filename = f"post_{post_id}_{seed_hash}.jpg"
    cached_filepath = Path(config.CACHE_IMAGE_DIR) / cached_filename

    if cached_filepath.exists() and cached_filepath.stat().st_size > 0:
        return send_from_directory(config.CACHE_IMAGE_DIR, cached_filename)

    # 未缓存时直接 302 重定向给客户端浏览器加载，杜绝后端 Gunicorn 进程阻塞等待海外网络
    external_url = f"https://picsum.photos/seed/{seed}/800/500"
    return redirect(external_url)


# ──────────────────────────────────────────────
# 管理端接口（需要登录）
# ──────────────────────────────────────────────

def _sync_temp_images_to_db():
    """
    自动将 /temp/images 缓存目录中的物理图片文件同步登记到 oss_images 图片库中。
    1. 避免重复添加已存在的 url；
    2. 若先前被软删除则自动恢复 deleted=0；
    3. 支持提取创建修改时间，确保可以在 OSS 图片库中即时查看与管理。
    """
    cache_dir = Path(config.CACHE_IMAGE_DIR)
    if not cache_dir.exists():
        return

    valid_exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'}
    files = [f for f in cache_dir.iterdir() if f.is_file() and f.suffix.lower() in valid_exts]
    if not files:
        return

    # 查询现有的 /temp/images/ 记录
    existing_records = {
        img.url: img
        for img in OssImage.query.filter(OssImage.url.like('/temp/images/%')).all()
    }

    changed = False
    for f in files:
        url = f"/temp/images/{f.name}"
        stat = f.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime)

        if url in existing_records:
            rec = existing_records[url]
            if rec.deleted == 1:
                rec.deleted = 0
                rec.update_time = datetime.now()
                changed = True
        else:
            new_img = OssImage(
                url=url,
                file_name=f.name,
                remark='系统缓存图片 (temp/images)',
                deleted=0,
                create_time=mtime,
                update_time=datetime.now()
            )
            db.session.add(new_img)
            changed = True

    if changed:
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()


@api_oss.route('/api/manage/oss/images', methods=['GET'])
@token_required
def oss_list_images():
    """分页获取图片库列表。支持类型筛选：cached=系统缓存图片，local=本地图片上传，external=外部OSS图片。"""
    _sync_temp_images_to_db()

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 24, type=int)
    search = request.args.get('search', '').strip()
    img_type = request.args.get('type', '').strip()  # cached | local | external

    query = OssImage.query.filter(OssImage.deleted == 0)

    # 图片分类筛选
    if img_type == 'cached':
        query = query.filter(OssImage.url.like('/temp/images/%'))
    elif img_type == 'local':
        query = query.filter(OssImage.url.like('/uploads/%'))
    elif img_type == 'external':
        query = query.filter(~OssImage.url.like('/temp/images/%'), ~OssImage.url.like('/uploads/%'))

    if search:
        safe_search = escape_like(search)
        query = query.filter(OssImage.url.like(f'%{safe_search}%') | OssImage.file_name.like(f'%{safe_search}%'))

    query = query.order_by(OssImage.create_time.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'images': [_serialize_image(img) for img in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'has_next': pagination.has_next,
        'has_prev': pagination.has_prev,
    })


@api_oss.route('/api/manage/oss/images', methods=['POST'])
@token_required
def oss_add_image():
    """手动新增一条图片 URL 到图片库。支持批量（传 urls 数组）。"""
    data = request.get_json() or {}
    urls = data.get('urls', [])
    single_url = data.get('url', '').strip()

    # 兼容单条和批量
    if single_url:
        urls = [single_url]

    if not urls:
        return jsonify({'msg': '请提供至少一个图片 URL'}), 400

    # 1. 批量预先加载已存在的 URL 记录，消除 N+1 数据库往返
    clean_urls = [u.strip() for u in urls if u and u.strip()]
    existing_map = {
        img.url: img
        for img in OssImage.query.filter(OssImage.url.in_(clean_urls)).all()
    }

    added = []
    skipped = []
    now = datetime.now()

    for url in clean_urls:
        if url in existing_map:
            rec = existing_map[url]
            if rec.deleted == 1:
                rec.deleted = 0
                rec.update_time = now
                added.append(_serialize_image(rec))
            else:
                skipped.append(url)
        else:
            img = OssImage(
                url=url,
                file_name=data.get('file_name') or _parse_filename(url),
                remark=data.get('remark', ''),
                deleted=0,
                create_time=now,
                update_time=now,
            )
            db.session.add(img)
            existing_map[url] = img
            added.append(_serialize_image(img))

    db.session.commit()
    return jsonify({
        'msg': f'成功添加 {len(added)} 张，跳过 {len(skipped)} 张（已存在）',
        'added': added,
        'skipped': skipped,
    }), 201


@api_oss.route('/api/manage/oss/images/<int:image_id>', methods=['PUT'])
@token_required
def oss_update_image(image_id: int):
    """修改图片备注或文件名。"""
    img = OssImage.query.filter(OssImage.id == image_id, OssImage.deleted == 0).first_or_404()
    data = request.get_json() or {}

    if 'file_name' in data and data['file_name'] is not None:
        img.file_name = data['file_name']
    if 'remark' in data:
        img.remark = data['remark']

    img.update_time = datetime.now()
    db.session.commit()
    return jsonify(_serialize_image(img))


@api_oss.route('/api/manage/oss/images/<int:image_id>', methods=['DELETE'])
@token_required
def oss_delete_image(image_id: int):
    """从图片库中移除（软删除），不影响 OSS 源文件。"""
    img = OssImage.query.filter(OssImage.id == image_id, OssImage.deleted == 0).first_or_404()
    img.deleted = 1
    img.update_time = datetime.now()
    db.session.commit()
    return jsonify({'msg': '已从图片库移除'})


@api_oss.route('/api/manage/oss/images/batch-delete', methods=['POST'])
@token_required
def oss_batch_delete():
    """批量从图片库中移除（软删除）。"""
    data = request.get_json() or {}
    ids = data.get('ids', [])
    if not ids:
        return jsonify({'msg': '请提供要删除的图片 ID 列表'}), 400

    OssImage.query.filter(OssImage.id.in_(ids), OssImage.deleted == 0).update(
        {OssImage.deleted: 1, OssImage.update_time: datetime.now()},
        synchronize_session=False
    )
    db.session.commit()
    return jsonify({'msg': f'已移除 {len(ids)} 张图片'})


@api_oss.route('/api/manage/oss/import-from-posts', methods=['POST'])
@token_required
def oss_import_from_posts():
    """
    从文章 thumbnail 字段批量导入现有 OSS 链接到图片库。
    批量聚合去重后一次性写入，消除 N+1 循环查询。
    """
    posts = Posts.query.filter(Posts.deleted == 0, Posts.thumbnail.isnot(None)).all()
    url_to_post = {}
    for p in posts:
        u = (p.thumbnail or '').strip()
        if u and u not in url_to_post:
            url_to_post[u] = p

    all_urls = list(url_to_post.keys())
    if not all_urls:
        return jsonify({'msg': '未找到带有封面的文章', 'added': 0, 'skipped': 0})

    existing_map = {
        img.url: img
        for img in OssImage.query.filter(OssImage.url.in_(all_urls)).all()
    }

    added = 0
    skipped = 0
    now = datetime.now()

    for url, post in url_to_post.items():
        if url in existing_map:
            rec = existing_map[url]
            if rec.deleted == 1:
                rec.deleted = 0
                rec.update_time = now
                added += 1
            else:
                skipped += 1
        else:
            img = OssImage(
                url=url,
                file_name=_parse_filename(url),
                remark=f'从文章「{post.title}」导入',
                deleted=0,
                create_time=now,
                update_time=now,
            )
            db.session.add(img)
            existing_map[url] = img
            added += 1

    db.session.commit()
    return jsonify({'msg': f'导入完成：新增 {added} 张，跳过 {skipped} 张（已存在）', 'added': added, 'skipped': skipped})


# ──────────────────────────────────────────────
# 真实图片文件上传接口
# ──────────────────────────────────────────────

@api_oss.route('/api/manage/upload', methods=['POST'])
@api_oss.route('/api/manage/oss/upload', methods=['POST'])
@token_required
def oss_upload_image():
    """
    真实图片文件上传端点。
    按年月目录持久化保存，自动注入 oss_images 图片库。
    """
    if 'file' not in request.files and 'files' not in request.files:
        return jsonify({'msg': '请选择要上传的图片文件'}), 400

    uploaded_files = request.files.getlist('files') or request.files.getlist('file')
    remark = request.form.get('remark', '').strip()
    sync_gallery = request.form.get('sync_to_gallery', 'true').lower() in ('true', '1', 'yes')

    now = datetime.now()
    year_month = now.strftime('%Y%m')
    save_dir = Path(config.UPLOAD_PATH) / 'images' / year_month
    save_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for file in uploaded_files:
        if not file or not file.filename:
            continue

        if not _allowed_file(file.filename):
            continue

        orig_name = file.filename
        ext = orig_name.rsplit('.', 1)[1].lower()
        unique_name = f"{now.strftime('%d%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
        target_path = save_dir / unique_name

        file.save(str(target_path))

        file_url = f"/uploads/images/{year_month}/{unique_name}"

        image_record = None
        if sync_gallery:
            image_record = OssImage(
                url=file_url,
                file_name=orig_name,
                remark=remark or '本地上传',
                deleted=0,
                create_time=now,
                update_time=now
            )
            db.session.add(image_record)
            db.session.flush()

        results.append({
            'url': file_url,
            'file_name': orig_name,
            'id': image_record.id if image_record else None
        })

    if sync_gallery and results:
        db.session.commit()

    if not results:
        return jsonify({'msg': '未找到有效图片，支持格式：png, jpg, jpeg, gif, webp, svg'}), 400

    return jsonify({
        'msg': f'成功上传 {len(results)} 张图片',
        'url': results[0]['url'],
        'file_name': results[0]['file_name'],
        'id': results[0]['id'],
        'items': results
    }), 201


# ──────────────────────────────────────────────
# 内部辅助函数
# ──────────────────────────────────────────────

def _serialize_image(img: OssImage) -> dict:
    return {
        'id': img.id,
        'url': img.url,
        'file_name': img.file_name or '',
        'remark': img.remark or '',
        'create_time': img.create_time.isoformat() if img.create_time else None,
        'update_time': img.update_time.isoformat() if img.update_time else None,
    }
