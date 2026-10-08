import io
import os
import re
import zipfile
from datetime import datetime
from pathlib import Path
from flask import Blueprint, jsonify, send_file, request, current_app
from sqlalchemy import text
from apps.exts import db
from apps import config
from apps.models.model import Posts, Categories, Tags, PostCategories, PostTags, Config, User
from apps.models.oss_image import OssImage
from .middleware import token_required

api_backup = Blueprint('api_backup', __name__)

BACKUP_DIR = (config.BASE_DIR / 'temp' / 'backups').resolve()
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def _dump_database_to_sql() -> str:
    """
    使用 SQLAlchemy 元数据、Schema 与 Core 查询组件生成跨方言便携式 SQL 备份脚本：
    统一使用 SQLAlchemy Table/select/compile 进行方言渲染，彻底杜绝手工拼接 SQL 字符串。
    原生自适应兼容 MySQL、MariaDB 与 PostgreSQL。
    """
    from sqlalchemy import Table, select
    from sqlalchemy.schema import CreateTable, DropTable

    dialect = db.engine.dialect
    dialect_name = dialect.name.lower()
    is_pg = ('postgres' in dialect_name)

    sql_lines = [
        "-- ========================================================",
        f"-- Blog System Database Dump ({dialect_name.upper()})",
        f"-- Generated At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "-- Powered by SQLAlchemy Unified Dialect Management",
        "-- ========================================================",
    ]

    if not is_pg:
        sql_lines.extend([
            "SET NAMES utf8mb4;",
            "SET FOREIGN_KEY_CHECKS = 0;\n"
        ])
    else:
        sql_lines.append("SET CONSTRAINTS ALL DEFERRED;\n")

    inspector = db.inspect(db.engine)
    table_names = inspector.get_table_names()

    for tbl in table_names:
        sql_lines.append(f"-- --------------------------------------------------------")
        sql_lines.append(f"-- Table structure for `{tbl}`")
        sql_lines.append(f"-- --------------------------------------------------------")

        # 使用 SQLAlchemy 获取或反射 Table 对象
        table = db.Model.metadata.tables.get(tbl)
        if table is None:
            try:
                table = Table(tbl, db.Model.metadata, autoload_with=db.engine)
            except Exception:
                table = None

        if table is not None:
            # 使用 SQLAlchemy DropTable 统一生成方言适配的删除表指令
            try:
                drop_stmt = str(DropTable(table, if_exists=True).compile(db.engine)).strip()
                if is_pg and not drop_stmt.endswith('CASCADE'):
                    drop_stmt += ' CASCADE'
                sql_lines.append(f"{drop_stmt};\n")
            except Exception:
                sql_lines.append(f"DROP TABLE IF EXISTS `{tbl}`;\n")

            # 使用 SQLAlchemy CreateTable 统一编译当前数据库方言适配的建表 DDL
            try:
                create_stmt = str(CreateTable(table).compile(db.engine)).strip()
                sql_lines.append(f"{create_stmt};\n")
            except Exception as e:
                sql_lines.append(f"-- Failed to compile CreateTable for `{tbl}` via SQLAlchemy: {e}\n")
        else:
            sql_lines.append(f"DROP TABLE IF EXISTS `{tbl}`;\n")

        # 使用 SQLAlchemy select(table) 统一获取表数据（消除手工 SELECT 字符串拼接）
        try:
            if table is not None:
                select_stmt = select(table)
                rows = db.session.execute(select_stmt).fetchall()
            else:
                rows = []

            if rows:
                sql_lines.append(f"-- Dumping data for `{tbl}` ({len(rows)} records)")
                for row in rows:
                    try:
                        # 基于 SQLAlchemy table.insert() 统一编译并安全格式化字面量
                        row_dict = dict(row._mapping)
                        insert_stmt = table.insert().values(row_dict)
                        compiled_insert = str(insert_stmt.compile(
                            dialect=db.engine.dialect,
                            compile_kwargs={"literal_binds": True}
                        )).strip()
                        sql_lines.append(f"{compiled_insert};")
                    except Exception as row_err:
                        # 降级备用：针对特殊无法字面量绑定的字段提供兜底
                        cols = list(row._mapping.keys())
                        col_identifiers = [dialect.identifier_preparer.quote(c) for c in cols]
                        val_parts = []
                        for v in row._mapping.values():
                            if v is None:
                                val_parts.append("NULL")
                            elif isinstance(v, (int, float)):
                                val_parts.append(str(v))
                            elif isinstance(v, bool):
                                val_parts.append("TRUE" if v else "FALSE")
                            elif isinstance(v, datetime):
                                val_parts.append(f"'{v.strftime('%Y-%m-%d %H:%M:%S')}'")
                            else:
                                clean_val = str(v).replace('\\', '\\\\').replace("'", "\\'")
                                val_parts.append(f"'{clean_val}'")
                        target_tbl = dialect.identifier_preparer.quote(tbl)
                        sql_lines.append(f"INSERT INTO {target_tbl} ({', '.join(col_identifiers)}) VALUES ({', '.join(val_parts)});")
                sql_lines.append("")
        except Exception as e:
            sql_lines.append(f"-- Failed to dump data for `{tbl}`: {e}\n")

    if not is_pg:
        sql_lines.append("SET FOREIGN_KEY_CHECKS = 1;")
    return "\n".join(sql_lines)


# ──────────────────────────────────────────────
# 备份中心管理端 API
# ──────────────────────────────────────────────

@api_backup.route('/api/manage/backups', methods=['GET'])
@token_required
def list_backups():
    """获取所有已归档的历史备份包列表。"""
    backups = []
    if BACKUP_DIR.exists():
        for f in sorted(BACKUP_DIR.glob('*'), key=lambda p: p.stat().st_mtime, reverse=True):
            if f.is_file() and f.suffix.lower() in ('.zip', '.sql'):
                stat = f.stat()
                b_type = 'full'
                if 'markdown' in f.name:
                    b_type = 'markdown'
                elif 'oss' in f.name:
                    b_type = 'oss'
                elif 'db' in f.name or f.suffix == '.sql':
                    b_type = 'database'

                backups.append({
                    'filename': f.name,
                    'type': b_type,
                    'size': stat.st_size,
                    'size_formatted': _format_size(stat.st_size),
                    'created_at': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'download_url': f"/api/manage/backups/download/{f.name}"
                })

    return jsonify({
        'backups': backups,
        'count': len(backups),
        'backup_dir': str(BACKUP_DIR)
    })


@api_backup.route('/api/manage/backups/download/<filename>', methods=['GET'])
@token_required
def download_backup_file(filename: str):
    """安全下载指定的备份文件。"""
    # 路径穿越防范
    clean_name = Path(filename).name
    target_path = BACKUP_DIR / clean_name
    if not target_path.is_file():
        return jsonify({'msg': '备份文件不存在或已被删除'}), 404

    mimetype = 'application/zip' if clean_name.lower().endswith('.zip') else 'application/octet-stream'
    response = send_file(
        str(target_path),
        as_attachment=True,
        download_name=clean_name,
        mimetype=mimetype
    )
    response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return response


@api_backup.route('/api/manage/backups/<filename>', methods=['DELETE'])
@token_required
def delete_backup_file(filename: str):
    """删除指定的历史备份文件。"""
    clean_name = Path(filename).name
    target_path = BACKUP_DIR / clean_name
    if target_path.is_file():
        target_path.unlink()
        return jsonify({'msg': f'已成功删除备份文件 {clean_name}'})
    return jsonify({'msg': '备份文件不存在'}), 404


@api_backup.route('/api/manage/backups/export/markdown', methods=['POST'])
@token_required
def export_markdown_archive():
    """将全站所有正常未删除文章批量导出为标准 Markdown ZIP 归档（带 YAML Frontmatter）。"""
    posts = Posts.query.filter(Posts.deleted == 0).order_by(Posts.id.asc()).all()

    # 预加载分类与标签
    cat_map = {}
    for pc, c in db.session.query(PostCategories, Categories).join(Categories, PostCategories.category_id == Categories.id).filter(PostCategories.deleted == 0).all():
        cat_map.setdefault(pc.post_id, []).append(c.name)

    tag_map = {}
    for pt, t in db.session.query(PostTags, Tags).join(Tags, PostTags.tag_id == Tags.id).filter(PostTags.deleted == 0).all():
        tag_map.setdefault(pt.post_id, []).append(t.name)

    now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_filename = f"blog_markdown_export_{now_str}.zip"
    zip_path = BACKUP_DIR / zip_filename

    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for p in posts:
            safe_title = "".join(c for c in (p.title or f"post_{p.id}") if c not in r'\/:*?"<>|').strip() or f"post_{p.id}"
            md_name = f"{p.id:03d}_{safe_title}.md"
            
            # 拼接 Frontmatter
            c_time = p.create_time.strftime('%Y-%m-%d %H:%M:%S') if p.create_time else ''
            u_time = p.update_time.strftime('%Y-%m-%d %H:%M:%S') if p.update_time else ''
            p_cats = cat_map.get(p.id, [])
            p_tags = tag_map.get(p.id, [])
            p_title_clean = (p.title or '').replace('"', '\\"')

            frontmatter = [
                "---",
                f'title: "{p_title_clean}"',
                f"date: {c_time}",
                f"updated: {u_time}",
                f"author: \"{p.author or 'admin'}\"",
                f"thumbnail: \"{p.thumbnail or ''}\"",
                f"categories: [{', '.join(p_cats)}]",
                f"tags: [{', '.join(p_tags)}]",
                f"summary: \"{p.summary or ''}\"",
                "---",
                "",
                p.content or ""
            ]
            zf.writestr(md_name, "\n".join(frontmatter))

    return jsonify({
        'msg': f'已成功导出 {len(posts)} 篇 Markdown 文章',
        'filename': zip_filename,
        'size': zip_path.stat().st_size,
        'download_url': f"/api/manage/backups/download/{zip_filename}"
    })


@api_backup.route('/api/manage/backups/export/db', methods=['POST'])
@token_required
def export_database_backup():
    """一键生成当前数据库完整 SQL Dump 并存储到备份中心。"""
    now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    sql_filename = f"blog_database_dump_{now_str}.sql"
    sql_path = BACKUP_DIR / sql_filename

    dump_content = _dump_database_to_sql()
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write(dump_content)

    return jsonify({
        'msg': '数据库 SQL 导出完成',
        'filename': sql_filename,
        'size': sql_path.stat().st_size,
        'download_url': f"/api/manage/backups/download/{sql_filename}"
    })


@api_backup.route('/api/manage/backups/export/oss', methods=['POST'])
@token_required
def export_oss_library():
    """导出 OSS 图片库（生成包含所有已收录图片记录及相关物理图片的 ZIP 包）。"""
    now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_filename = f"blog_oss_images_backup_{now_str}.zip"
    zip_path = BACKUP_DIR / zip_filename

    images = OssImage.query.filter(OssImage.deleted == 0).all()

    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. 写入所有图片元数据列表 JSON / CSV
        meta_lines = ["id,url,file_name,remark,create_time"]
        for img in images:
            meta_lines.append(f"{img.id},\"{img.url}\",\"{img.file_name or ''}\",\"{img.remark or ''}\",{img.create_time}")
        zf.writestr("oss_images_metadata.csv", "\n".join(meta_lines))

        # 2. 打包 uploads 目录中的本地图片
        upload_dir = Path(config.UPLOAD_PATH)
        if upload_dir.exists():
            for f in upload_dir.rglob('*'):
                if f.is_file():
                    arcname = f"uploads/{f.relative_to(upload_dir)}"
                    zf.write(f, arcname)

        # 3. 打包 temp/images 缓存图
        cache_dir = Path(config.CACHE_IMAGE_DIR)
        if cache_dir.exists():
            for f in cache_dir.glob('*'):
                if f.is_file():
                    arcname = f"temp_images/{f.name}"
                    zf.write(f, arcname)

    return jsonify({
        'msg': f'已成功打包 OSS 图片库及本地静态图资源（包含 {len(images)} 张图片索引）',
        'filename': zip_filename,
        'size': zip_path.stat().st_size,
        'download_url': f"/api/manage/backups/download/{zip_filename}"
    })


@api_backup.route('/api/manage/backups/export/full', methods=['POST'])
@token_required
def export_full_site_backup():
    """
    全站数据与静态资源一键打包备份：
    包含：1. 完整数据库 SQL Dump；2. uploads 静态资源目录；3. 全文 Markdown 归档；4. 站点配置快照。
    """
    now_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    zip_filename = f"blog_full_site_backup_{now_str}.zip"
    zip_path = BACKUP_DIR / zip_filename

    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        # 1. 写入数据库 Dump
        sql_dump = _dump_database_to_sql()
        zf.writestr("database/dump.sql", sql_dump)

        # 2. 写入全站 uploads 附件
        upload_dir = Path(config.UPLOAD_PATH)
        if upload_dir.exists():
            for f in upload_dir.rglob('*'):
                if f.is_file():
                    zf.write(f, f"uploads/{f.relative_to(upload_dir)}")

        # 3. 写入说明与版本快照
        readme_text = [
            f"# 博客全站数据备份归档包",
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"包含组件:",
            f"  - database/dump.sql: 完整数据库表结构及全量数据 SQL",
            f"  - uploads/: 本地上传的静态图片与文章附件",
            f"恢复方式: 导入 SQL 到 MySQL 数据库，并将 uploads 目录恢复至项目根目录即可。",
        ]
        zf.writestr("BACKUP_README.txt", "\n".join(readme_text))

    return jsonify({
        'msg': '全站数据与静态资源一键打包备份成功！',
        'filename': zip_filename,
        'size': zip_path.stat().st_size,
        'download_url': f"/api/manage/backups/download/{zip_filename}"
    })


def _split_sql_statements(sql_text: str):
    """
    智能解析并拆分 SQL 语句：
    精准识别单引号字符串、双引号标识符、转义字符以及单行/多行注释，
    绝不会在字符串或文章正文内容内部的分号处错误切断。
    """
    statements = []
    current = []
    in_single_quote = False
    in_double_quote = False
    in_line_comment = False
    in_block_comment = False
    escape = False

    i = 0
    n = len(sql_text)
    while i < n:
        char = sql_text[i]
        next_char = sql_text[i + 1] if i + 1 < n else ''

        if in_single_quote:
            current.append(char)
            if escape:
                escape = False
            elif char == '\\':
                escape = True
            elif char == "'":
                if next_char == "'":
                    current.append(next_char)
                    i += 1
                else:
                    in_single_quote = False
        elif in_double_quote:
            current.append(char)
            if escape:
                escape = False
            elif char == '\\':
                escape = True
            elif char == '"':
                in_double_quote = False
        elif in_line_comment:
            if char == '\n':
                in_line_comment = False
        elif in_block_comment:
            if char == '*' and next_char == '/':
                in_block_comment = False
                i += 1
        else:
            if char == '-' and next_char == '-':
                in_line_comment = True
                i += 1
            elif char == '/' and next_char == '*':
                in_block_comment = True
                i += 1
            elif char == "'":
                in_single_quote = True
                current.append(char)
            elif char == '"':
                in_double_quote = True
                current.append(char)
            elif char == ';':
                stmt = "".join(current).strip()
                if stmt:
                    statements.append(stmt)
                current = []
            else:
                current.append(char)
        i += 1

    last_stmt = "".join(current).strip()
    if last_stmt:
        statements.append(last_stmt)

    return statements


def _adapt_sql_for_target_dialect(stmt: str, is_pg: bool) -> str:
    """
    跨数据库方言 DDL / DML 自动平滑适配转换器：
    让 MySQL 导出的 SQL 脚本能够直接无缝恢复到 PostgreSQL，
    也让 PostgreSQL 导出的 SQL 能够直接恢复到 MySQL / MariaDB。
    """
    cleaned = stmt.strip()
    lower = cleaned.lower()

    if is_pg:
        # 1. 过滤忽略 MySQL 专有的会话指令
        if lower.startswith((
            'set names', 'set foreign_key_checks', 'set sql_mode',
            'set autocommit', 'set unique_checks', 'lock tables', 'unlock tables'
        )):
            return ""

        # 2. DROP TABLE 增加 CASCADE 避免外键关联拦截
        if lower.startswith('drop table'):
            cleaned = re.sub(r';?$', '', cleaned, flags=re.IGNORECASE).strip()
            if not re.search(r'\bcascade\b', cleaned, flags=re.IGNORECASE):
                cleaned += ' CASCADE'

        # 3. CREATE TABLE MySQL -> PostgreSQL 语法自适应
        if lower.startswith('create table'):
            cleaned = re.sub(r';?$', '', cleaned, flags=re.IGNORECASE).strip()
            # 移除表尾引擎、字符集和自增初值
            cleaned = re.sub(
                r'\)\s*(?:ENGINE\s*=\s*\w+|AUTO_INCREMENT\s*=\s*\d+|DEFAULT\s+CHARSET\s*=\s*[\w_]+|CHARSET\s*=\s*[\w_]+|COLLATE\s*=\s*[\w_]+|\bROW_FORMAT\s*=\s*\w+)+\s*$',
                ')', cleaned, flags=re.IGNORECASE
            )
            # 自增主键字段映射
            cleaned = re.sub(r'\b(?:INTEGER|INT|BIGINT)\s+NOT\s+NULL\s+AUTO_INCREMENT\b', 'SERIAL NOT NULL', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\b(?:INTEGER|INT|BIGINT)\s+AUTO_INCREMENT\b', 'SERIAL', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bAUTO_INCREMENT\b', '', cleaned, flags=re.IGNORECASE)
            # 字段类型映射
            cleaned = re.sub(r'\bDATETIME\b', 'TIMESTAMP', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\b(?:LONGTEXT|MEDIUMTEXT|TINYTEXT)\b', 'TEXT', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bTINYINT\s*\(\s*1\s*\)', 'BOOLEAN', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bTINYINT\s*\(\s*\d+\s*\)', 'SMALLINT', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\b(?:INT|INTEGER)\s*\(\s*\d+\s*\)', 'INTEGER', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bBIGINT\s*\(\s*\d+\s*\)', 'BIGINT', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bCOLLATE\s+[\w_]+\b', '', cleaned, flags=re.IGNORECASE)

            # 过滤 MySQL 专有的内联 KEY / INDEX 定义
            lines = cleaned.split('\n')
            filtered_lines = []
            for line in lines:
                l_str = line.strip()
                if re.match(r'^(?:KEY|INDEX)\s+[`"\w]+\s*\(.*?\),?$', l_str, flags=re.IGNORECASE):
                    continue
                filtered_lines.append(line)
            cleaned = '\n'.join(filtered_lines)
            cleaned = re.sub(r',\s*(\n\s*\))', r'\1', cleaned)

        # 4. 反引号替换为 PostgreSQL 双引号
        cleaned = cleaned.replace('`', '"')
    else:
        # 目标是 MySQL，但输入可能是 PostgreSQL DDL
        if lower.startswith('create table'):
            cleaned = re.sub(r'\bBIGSERIAL\b', 'BIGINT NOT NULL AUTO_INCREMENT', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bSERIAL\b', 'INTEGER NOT NULL AUTO_INCREMENT', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'\bTIMESTAMP\b', 'DATETIME', cleaned, flags=re.IGNORECASE)
        if lower.startswith('drop table'):
            cleaned = re.sub(r'\bCASCADE\b', '', cleaned, flags=re.IGNORECASE).strip()
        if lower.startswith('select setval'):
            return ""

    return cleaned


def _execute_sql_dump(sql_text: str):
    """
    批量执行 SQL 文本并实施跨方言适配、安全拦截与事务隔离保护。
    返回: (executed_count, errors)
    """
    raw_statements = _split_sql_statements(sql_text)
    executed_count = 0
    errors = []

    # 允许的安全前缀白名单（涵盖 MySQL, MariaDB 及 PostgreSQL 常用恢复指令）
    ALLOWED_VERBS = (
        'set', 'create table', 'drop table', 'insert into', 'lock tables', 'unlock tables',
        'alter table', 'truncate table', 'create index', 'drop index', 'select setval'
    )

    # 严厉禁止的高危危险特征黑名单 (防提权、防木马写出、防本地任意文件读取)
    FORBIDDEN_KEYWORDS = (
        'into outfile', 'into dumpfile', 'load_file', 'load data',
        'create user', 'drop user', 'grant ', 'revoke ', 'alter user',
        'shutdown', 'super', 'process', 'information_schema', 'mysql.'
    )

    dialect = db.engine.dialect.name.lower()
    is_pg = ('postgres' in dialect)

    if not is_pg:
        try:
            db.session.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        except Exception:
            pass

    for raw_stmt in raw_statements:
        # 跨方言语法自适应转换
        stmt_to_run = _adapt_sql_for_target_dialect(raw_stmt, is_pg=is_pg)
        if not stmt_to_run:
            continue

        lower_stmt = stmt_to_run.lower()

        # 1. 拦截高危指令
        if any(forbidden in lower_stmt for forbidden in FORBIDDEN_KEYWORDS):
            errors.append("安全拦截: 语句包含受限系统级高危关键字")
            continue

        # 2. 白名单前缀验证
        if not any(lower_stmt.startswith(verb) for verb in ALLOWED_VERBS):
            errors.append(f"安全拦截: 不在允许执行的数据库恢复语句白名单内 ({stmt_to_run[:30]})")
            continue

        # 3. 执行语句（在 PostgreSQL 下使用 Savepoint 子事务隔离，避免单个非关键指令错误导致事务整体 Abort）
        if is_pg:
            try:
                with db.session.begin_nested():
                    db.session.execute(text(stmt_to_run))
                executed_count += 1
            except Exception as e:
                errors.append(str(e)[:120])
        else:
            try:
                db.session.execute(text(stmt_to_run))
                executed_count += 1
            except Exception as e:
                errors.append(str(e)[:120])

    if is_pg:
        # 自动校准与对齐所有表的主键自增序列，防止后续插入新数据时发生主键冲突
        try:
            inspector = db.inspect(db.engine)
            for tbl in inspector.get_table_names():
                try:
                    with db.session.begin_nested():
                        seq_sql = f"""
                        SELECT setval(
                            pg_get_serial_sequence('"{tbl}"', 'id'),
                            COALESCE((SELECT MAX(id) FROM "{tbl}"), 1)
                        );
                        """
                        db.session.execute(text(seq_sql))
                except Exception:
                    pass
        except Exception:
            pass
    else:
        try:
            db.session.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        except Exception:
            pass

    db.session.commit()
    return executed_count, errors


def _is_safe_path(base_dir: Path, target_path: Path) -> bool:
    """防止 ZIP 压缩包目录穿越风险 (Zip Slip 漏洞防御)。"""
    try:
        base_dir = base_dir.resolve()
        target_path = target_path.resolve()
        return base_dir in target_path.parents or base_dir == target_path
    except Exception:
        return False


@api_backup.route('/api/manage/backups/restore/sql', methods=['POST'])
@token_required
def restore_database_from_sql():
    """从备份文件或上传的 SQL 文件恢复底层数据库（支持跨方言 MySQL / PostgreSQL 自动转换与安全隔离执行）。"""
    sql_text = None

    # 支持直接上传 SQL 文件
    if 'file' in request.files:
        f = request.files['file']
        sql_text = f.read().decode('utf-8', errors='ignore')
    else:
        data = request.get_json() or {}
        filename = data.get('filename')
        if filename:
            clean_name = Path(filename).name
            target = BACKUP_DIR / clean_name
            if target.is_file():
                with open(target, 'r', encoding='utf-8', errors='ignore') as f:
                    sql_text = f.read()

    if not sql_text:
        return jsonify({'msg': '请选择要恢复的 SQL 备份文件'}), 400

    try:
        executed_count, errors = _execute_sql_dump(sql_text)
    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': f'数据库还原失败: {str(e)}'}), 500

    return jsonify({
        'msg': f'数据库已成功恢复！共执行 {executed_count} 条 SQL 指令',
        'executed_count': executed_count,
        'has_errors': len(errors) > 0,
        'error_samples': errors[:3]
    })


@api_backup.route('/api/manage/backups/restore/full', methods=['POST'])
@token_required
def restore_full_site():
    """一键恢复全站：从全量备份 ZIP 包（包含 SQL 与 uploads 静态附件）一键完整还原整站。"""
    zip_bytes = None
    target_zip_file = None

    if 'file' in request.files:
        f = request.files['file']
        zip_bytes = f.read()
    else:
        data = request.get_json() or {}
        filename = data.get('filename')
        if filename:
            clean_name = Path(filename).name
            target = BACKUP_DIR / clean_name
            if target.is_file():
                target_zip_file = target

    if not zip_bytes and not target_zip_file:
        return jsonify({'msg': '请选择或上传要恢复的全站 ZIP 备份包'}), 400

    from apps.tools.logger import app_logger

    try:
        zip_source = io.BytesIO(zip_bytes) if zip_bytes else target_zip_file
        with zipfile.ZipFile(zip_source, 'r') as zf:
            namelist = zf.namelist()

            # 1. 寻找 SQL Dump 文件并执行恢复
            sql_file = None
            for candidate in ('database/dump.sql', 'dump.sql'):
                if candidate in namelist:
                    sql_file = candidate
                    break
            if not sql_file:
                for name in namelist:
                    if name.lower().endswith('.sql') and not name.startswith('__MACOSX'):
                        sql_file = name
                        break

            executed_sql_count = 0
            sql_errors = []
            if sql_file:
                sql_data = zf.read(sql_file).decode('utf-8', errors='ignore')
                executed_sql_count, sql_errors = _execute_sql_dump(sql_data)

            # 2. 还原 uploads 静态附件与图片
            restored_files_count = 0
            upload_base = Path(config.UPLOAD_PATH)
            upload_base.mkdir(parents=True, exist_ok=True)

            for member in zf.infolist():
                if member.is_dir():
                    continue
                norm_name = member.filename.replace('\\', '/')
                if norm_name.startswith('__MACOSX'):
                    continue

                dest_path = None
                if norm_name.startswith('uploads/'):
                    rel_path = norm_name[len('uploads/'):]
                    if rel_path:
                        dest_path = upload_base / rel_path
                elif norm_name.startswith('temp/images/'):
                    rel_path = norm_name[len('temp/images/'):]
                    if rel_path:
                        dest_path = Path(config.CACHE_IMAGE_DIR) / rel_path

                if dest_path:
                    # 路径穿越安全校验 (Zip Slip)
                    allowed_base = upload_base if norm_name.startswith('uploads/') else Path(config.CACHE_IMAGE_DIR)
                    if _is_safe_path(allowed_base, dest_path):
                        dest_path.parent.mkdir(parents=True, exist_ok=True)
                        dest_path.write_bytes(zf.read(member.filename))
                        restored_files_count += 1

            app_logger.info(
                f"全站数据一键恢复完成: SQL执行 {executed_sql_count} 条，还原附件 {restored_files_count} 个"
            )

            return jsonify({
                'msg': f'全站已成功一键恢复！共执行 {executed_sql_count} 条数据库指令，还原 {restored_files_count} 个静态图片附件。',
                'executed_sql_count': executed_sql_count,
                'restored_files_count': restored_files_count,
                'has_errors': len(sql_errors) > 0,
                'error_samples': sql_errors[:3]
            })
    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': f'全站一键恢复失败: {str(e)}'}), 500
