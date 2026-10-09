from flask_sqlalchemy import SQLAlchemy  # 导入SQLAlchemy包
from flask_migrate import Migrate
from datetime import datetime
from sqlalchemy import text
from apps.tools.tools import generate_password

db = SQLAlchemy()  # ORM 创建数据库sqlalchemy工具对象
migrate = Migrate()  # 创建对象


def init_exts(app):
    db.init_app(app=app)
    migrate.init_app(app=app, db=db)

    # 自动创建表与初始化数据 (带重试保护与跨 Worker 排他锁，避免 Gunicorn 多进程并发冲突)
    with app.app_context():
        import time
        from apps.tools.logger import app_logger

        dialect_name = db.engine.dialect.name.lower()
        is_pg = ('postgres' in dialect_name)
        is_mysql = ('mysql' in dialect_name or 'maria' in dialect_name)

        # 1. 尝试获取数据库级排他锁 (防止 Gunicorn 多个 worker 同时建表导致重复创建类型或冲突)
        have_lock = False
        try:
            if is_pg:
                # 使用 PostgreSQL Advisory Lock (锁标识 987654321)
                db.session.execute(text("SELECT pg_advisory_lock(987654321);"))
                have_lock = True
            elif is_mysql:
                # 使用 MySQL GET_LOCK，等待最多 10 秒
                res = db.session.execute(text("SELECT GET_LOCK('aeronote_init_lock', 10);")).scalar()
                have_lock = bool(res == 1)
        except Exception as lock_err:
            app_logger.warning(f"获取初始化排他锁提示 (非致命): {lock_err}")

        try:
            initialized = False
            for attempt in range(1, 11):
                try:
                    from apps.models.model import Config, User, Categories, Tags, Posts
                    from apps.models.oss_image import OssImage  # noqa: F401
                    db.create_all()
                    initialized = True
                    break
                except Exception as e:
                    app_logger.warning(f"Database connection attempt {attempt}/10 failed: {e}")
                    time.sleep(2)

            if not initialized:
                app_logger.error("Could not initialize database on startup. Workers will run in degraded mode.")
                return

            # 使用 SQLAlchemy inspect 跨数据库统一管理表结构反射与增量迁移
            try:
                from sqlalchemy import inspect
                inspector = inspect(db.engine)
                existing_tables = set(inspector.get_table_names())

                if 'posts' in existing_tables:
                    posts_cols = {col['name'] for col in inspector.get_columns('posts')}
                    # 自适应补全新增字段 summary
                    if 'summary' not in posts_cols:
                        if is_mysql:
                            db.session.execute(text('ALTER TABLE posts ADD COLUMN summary VARCHAR(1024) NULL'))
                        elif is_pg:
                            db.session.execute(text('ALTER TABLE posts ADD COLUMN IF NOT EXISTS summary VARCHAR(1024)'))
                        db.session.commit()

                    # 对 MySQL/MariaDB 历史老表内容字段进行大文本扩容
                    if is_mysql:
                        db.session.execute(text('ALTER TABLE posts MODIFY COLUMN content LONGTEXT'))
                        db.session.commit()

                if 'users' in existing_tables:
                    if is_mysql:
                        db.session.execute(text('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL'))
                    elif is_pg:
                        db.session.execute(text('ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(255)'))
                    db.session.commit()
            except Exception as e:
                app_logger.warning(f"数据库结构自检/增量迁移提示: {e}")
                db.session.rollback()

            # 检查是否为空白数据库（Config 表为空），使用 no_autoflush 防止在查询前过早 flush
            try:
                with db.session.no_autoflush:
                    if Config.query.first() is None:
                        configs = [
                            Config(id=1, name='website_url', value='https://hesc.info'),
                            Config(id=2, name='website_title', value='AeroNote'),
                            Config(id=3, name='website_keywords', value='Splunk;Python;Shell;MySQL;Linux;Docker;AI'),
                            Config(id=4, name='website_desc', value='记录技术沉淀 · 分享生活思考 · 散漫而行'),
                            Config(id=5, name='website_icp', value='湘ICP备20003211号-2'),
                            Config(id=6, name='about_profile_subtitle', value='💻 不专业的黑客 / 安全运营 / Splunk专家 / 技术博主'),
                            Config(id=7, name='homepage_subtitle', value='记录技术 · 分享生活 · 散漫而行')
                        ]
                        db.session.add_all(configs)

                    if User.query.filter_by(username='admin').first() is None:
                        admin_user = User(
                            id=1,
                            username='admin',
                            password=generate_password('admin'),
                            email='mr.hesc@outlook.com',
                            name='管理员',
                            description='管理员账号',
                            create_time=datetime.now(),
                            update_time=datetime.now(),
                            deleted=0
                        )
                        db.session.add(admin_user)

                    if Categories.query.first() is None:
                        categories = [
                            Categories(id=1, name='默认分类', description='这是你的默认分类，如不需要，删除即可。', slug='default', color='#41baff', create_time=datetime.now(), update_time=datetime.now(), deleted=0, parent_id=0),
                            Categories(id=2, name='Oracle', description='Oracle', slug='oracle', color='#41baff', create_time=datetime.now(), update_time=datetime.now(), deleted=0, parent_id=0),
                            Categories(id=3, name='Splunk', description='Splunk分类', slug='splunk', color='#41baff', create_time=datetime.now(), update_time=datetime.now(), deleted=0, parent_id=0)
                        ]
                        db.session.add_all(categories)

                    if Tags.query.first() is None:
                        tags = [
                            Tags(id=1, name='Oracle', slug='oracle', color='#c12323', create_time=datetime.now(), deleted=0),
                            Tags(id=2, name='Nginx', slug='nginx', color='#06bb5a', create_time=datetime.now(), deleted=0),
                            Tags(id=3, name='Linux', slug='linux', color='#2d7ac7', create_time=datetime.now(), deleted=0)
                        ]
                        db.session.add_all(tags)

                    if Posts.query.first() is None:
                        hello_post = Posts(
                            id=1,
                            title='Hello World',
                            author='admin',
                            content='欢迎使用个人技术博客系统！这是你的第一篇文章。',
                            access_count=0,
                            status=0,
                            create_time=datetime.now(),
                            update_time=datetime.now(),
                            deleted=0
                        )
                        db.session.add(hello_post)

                db.session.commit()

                # PostgreSQL 自动对齐自增序列
                if is_pg:
                    try:
                        from sqlalchemy import inspect
                        insp = inspect(db.engine)
                        for tbl in ('config', 'users', 'categories', 'tags', 'posts'):
                            if tbl in insp.get_table_names():
                                seq_sql = f"""
                                SELECT setval(
                                    pg_get_serial_sequence('"{tbl}"', 'id'),
                                    COALESCE((SELECT MAX(id) FROM "{tbl}"), 1)
                                );
                                """
                                db.session.execute(text(seq_sql))
                        db.session.commit()
                    except Exception:
                        pass
            except Exception as seed_err:
                app_logger.warning(f"种子数据写入提示: {seed_err}")
                db.session.rollback()

        finally:
            # 释放排他锁
            if have_lock:
                try:
                    if is_pg:
                        db.session.execute(text("SELECT pg_advisory_unlock(987654321);"))
                    elif is_mysql:
                        db.session.execute(text("SELECT RELEASE_LOCK('aeronote_init_lock');"))
                    db.session.commit()
                except Exception:
                    pass


