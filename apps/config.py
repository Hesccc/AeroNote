import os
import logging
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv

# 加载项目根目录下的 .env 文件
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

# 安全密钥
SECRET_KEY = os.getenv('SECRET_KEY', 'default-dev-secret-key-please-change-in-env')
if SECRET_KEY == 'default-dev-secret-key-please-change-in-env':
    logging.warning('SECRET_KEY 正在使用内置默认值，生产环境务必在 .env 中配置随机强密钥！')

# CORS 允许的来源（逗号分隔），生产环境建议配置为具体前端域名
CORS_ORIGINS = [o.strip() for o in os.getenv('CORS_ORIGINS', '*').split(',') if o.strip()]

# ─────────────────────────────────────────────────────────────
# 数据库配置与多方言自动适配 (PostgreSQL / MySQL / MariaDB)
# ─────────────────────────────────────────────────────────────
# 从 .env 读取数据库类型（大小写不敏感，如 MySQL, MariaDB, PostgreSQL）
RAW_DB_TYPE = os.getenv('DB_TYPE', '').lower().strip()
DB_PORT_RAW = os.getenv('DB_PORT', '').strip()

if RAW_DB_TYPE in ('postgres', 'postgresql', 'pgsql', 'pg') or (not RAW_DB_TYPE and DB_PORT_RAW == '5432'):
    DB_TYPE = 'PostgreSQL'
    DB_DIALECT = 'postgresql'
    DEFAULT_PORT = '5432'
    DEFAULT_USER = 'postgres'
elif RAW_DB_TYPE in ('mariadb', 'maria'):
    DB_TYPE = 'MariaDB'
    DB_DIALECT = 'mariadb'
    DEFAULT_PORT = '3306'
    DEFAULT_USER = 'root'
else:
    # 默认 MySQL
    DB_TYPE = 'MySQL'
    DB_DIALECT = 'mysql'
    DEFAULT_PORT = '3306'
    DEFAULT_USER = 'root'

IS_POSTGRES = (DB_DIALECT == 'postgresql')
PORT = DB_PORT_RAW or DEFAULT_PORT

HOSTNAME = os.getenv('DB_HOST', '127.0.0.1')
DATABASE = os.getenv('DB_NAME', 'aeronote')
USERNAME = os.getenv('DB_USER', DEFAULT_USER)
PASSWORD = os.getenv('DB_PASSWORD', '')

# 对用户名和密码进行 URL 安全编码，防止特殊字符（如 @, :, /, ?）导致连接串解析失败
encoded_user = urllib.parse.quote_plus(USERNAME) if USERNAME else ''
encoded_password = urllib.parse.quote_plus(PASSWORD) if PASSWORD else ''

if encoded_password:
    auth_part = f"{encoded_user}:{encoded_password}"
elif encoded_user:
    auth_part = encoded_user
else:
    auth_part = ""

DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    DB_URI = DATABASE_URL
    # 若显式传入 DATABASE_URL，自适应校准方言标识
    if 'postgresql' in DATABASE_URL.lower():
        DB_TYPE = 'PostgreSQL'
        DB_DIALECT = 'postgresql'
        IS_POSTGRES = True
    elif 'mariadb' in DATABASE_URL.lower():
        DB_TYPE = 'MariaDB'
        DB_DIALECT = 'mariadb'
        IS_POSTGRES = False
    else:
        DB_TYPE = 'MySQL'
        DB_DIALECT = 'mysql'
        IS_POSTGRES = False
elif IS_POSTGRES:
    auth_prefix = f"{auth_part}@" if auth_part else ""
    DB_URI = f'postgresql+psycopg2://{auth_prefix}{HOSTNAME}:{PORT}/{DATABASE}'
else:
    # MySQL / MariaDB 统一采用 pymysql 驱动并指定 utf8mb4 字符集
    auth_prefix = f"{auth_part}@" if auth_part else ""
    DB_URI = f'mysql+pymysql://{auth_prefix}{HOSTNAME}:{PORT}/{DATABASE}?charset=utf8mb4'

SQLALCHEMY_DATABASE_URI = DB_URI
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_pre_ping': True,  # 开启心跳检测，自动回收断开连接，避免数据库超时闪断
    'pool_recycle': 3600,   # 每小时回收连接，防止连接池泄漏
}

# 上传配置
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
UPLOAD_PATH = (BASE_DIR / UPLOAD_FOLDER).resolve()
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))

# 外部图床本地缓存目录 (temp/images)
CACHE_IMAGE_DIR = (BASE_DIR / 'temp' / 'images').resolve()
CACHE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)

# LLM 大模型配置 (OpenAI 兼容规范)
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
