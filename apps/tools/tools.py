import hashlib
import platform
import importlib.metadata
import logging
import subprocess
import psutil
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


def escape_like(search_str: str) -> str:
    """
    对 SQL LIKE 查询中的特殊通配符 % 与 _ 以及转义符 \\ 进行安全转义，
    防止利用通配符进行全表扫描拒绝服务攻击 (Wildcard DoS) 或模糊注入。
    """
    if not search_str:
        return ''
    return search_str.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


# ──────────────────────────────────────────────
# 密码安全处理与平滑无感升级
# ──────────────────────────────────────────────

def pwd_convert(passwd: str) -> str:
    """历史 MD5 加密（保留用于老密码平滑比对）。"""
    hl = hashlib.md5()
    hl.update(passwd.encode(encoding='utf8'))
    return hl.hexdigest()


def generate_password(passwd: str) -> str:
    """使用工业级安全加盐哈希（Werkzeug scrypt / pbkdf2）。"""
    return generate_password_hash(passwd)


def verify_and_upgrade_password(user, input_passwd: str, db_session) -> bool:
    """
    验证用户密码，并在使用旧版 MD5 验证成功时自动静默升级为加盐安全哈希。
    """
    stored = user.password or ''

    # 1. 检查是否为现代加盐哈希格式（例如 Werkzeug 的 scrypt: 或 pbkdf2: 格式，包含 $ 符号）
    if '$' in stored or stored.startswith(('scrypt:', 'pbkdf2:')):
        return check_password_hash(stored, input_passwd)

    # 2. 检查是否为历史 MD5 哈希
    if pwd_convert(input_passwd) == stored:
        # 验证通过，自动将密码无感升级为安全哈希并保存
        try:
            user.password = generate_password(input_passwd)
            db_session.commit()
        except Exception as e:
            db_session.rollback()
            logging.error(f"Failed to auto-upgrade password for user {user.username}: {e}")
        return True

    return False


# ──────────────────────────────────────────────
# 缓存的系统环境检测（彻底消除 subprocess 与 CPU 阻塞开销）
# ──────────────────────────────────────────────

_STATIC_ENV_CACHE = None


def _get_static_env():
    global _STATIC_ENV_CACHE
    if _STATIC_ENV_CACHE is not None:
        return _STATIC_ENV_CACHE

    # 获取 Node.js 版本（仅一次）
    try:
        result = subprocess.run(
            ['node', '-v'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=False,
            timeout=2
        )
        node_v = result.stdout.strip() if result.returncode == 0 else "Unknown"
    except Exception:
        node_v = "Unknown"

    flask_v = importlib.metadata.version("flask")
    sqla_v = importlib.metadata.version("flask_sqlalchemy")
    py_v = platform.python_version()
    os_name = platform.system()

    db_name = "MySQL"
    try:
        from apps.exts import db
        from apps import config
        dialect = db.engine.dialect
        dialect_name = dialect.name.lower()

        if 'postgres' in dialect_name:
            db_name = "PostgreSQL"
        elif 'sqlite' in dialect_name:
            db_name = "SQLite"
        elif getattr(dialect, 'is_mariadb', False) or config.DB_TYPE == 'MariaDB':
            db_name = "MariaDB"
        elif config.DB_TYPE in ('MySQL', 'MariaDB', 'PostgreSQL'):
            db_name = config.DB_TYPE
        else:
            db_name = "MySQL"
    except Exception:
        from apps import config
        db_name = getattr(config, 'DB_TYPE', 'MySQL')

    _STATIC_ENV_CACHE = {
        'os': os_name,
        'python_v': py_v,
        'flask_v': flask_v,
        'SQLAlchemy_v': sqla_v,
        'node_v': node_v,
        'run_env': f"Python:{py_v}; OS:{os_name}; Flask:{flask_v}; SQLAlchemy:{sqla_v}; Node:{node_v}",
        'blog_v': "v1.2.0",
        'db_type': db_name,
    }

    # 首次预触发一次 CPU 统计，使后续 non-blocking 获取有效
    try:
        psutil.cpu_percent(interval=None)
    except Exception:
        pass

    return _STATIC_ENV_CACHE


def env():
    """获取系统运行时监控数据，消除 100ms 阻塞与进程创建开销。"""
    static_info = _get_static_env()

    # 非阻塞式获取系统资源
    try:
        cpu_usage = psutil.cpu_percent(interval=None)
        mem_usage = psutil.virtual_memory().percent
    except Exception:
        cpu_usage = 0.0
        mem_usage = 0.0

    env_data = {
        **static_info,
        'datetime': datetime.now(),
        'cpu_usage': cpu_usage,
        'mem_usage': mem_usage
    }
    return env_data


def setup_custom_logger(name, log_file=None):
    from apps.tools.logger import get_module_logger
    return get_module_logger(name)
