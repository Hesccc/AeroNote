from flask import Flask, send_from_directory, request, g, jsonify
from flask_cors import CORS
from .exts import init_exts
from . import config
from .api.auth import api_auth
from .api.posts import api_posts
from .api.config import api_config
from .api.oss import api_oss
from .api.ai import api_ai
from .api.backup import api_backup
from .api.open import api_open
from .api.halo import api_halo
from .tools.logger import app_logger, api_logger, archive_historical_logs
import datetime
import time


def create_apps():
    # 启动时自动检查并归档压缩历史日志 (生成 日志分类_YYYYMMDD.log.tgz)
    archive_historical_logs()

    app = Flask(__name__)
    app_logger.info(f"=== AeroNote 系统服务初始化 (DB_TYPE: {config.DB_TYPE}) ===")
    
    # 启用跨域资源共享 (CORS) - 允许来源通过环境变量 CORS_ORIGINS 配置（默认 *，生产环境建议收紧）
    CORS(app, resources={
        r"/api/*": {"origins": config.CORS_ORIGINS},
        r"/apis/*": {"origins": config.CORS_ORIGINS},
        r"/uploads/*": {"origins": config.CORS_ORIGINS},
        r"/temp/*": {"origins": config.CORS_ORIGINS},
    })

    # 注册 API 蓝图
    app.register_blueprint(blueprint=api_auth)
    app.register_blueprint(blueprint=api_posts)
    app.register_blueprint(blueprint=api_config)
    app.register_blueprint(blueprint=api_oss)
    app.register_blueprint(blueprint=api_ai)
    app.register_blueprint(blueprint=api_backup)
    app.register_blueprint(blueprint=api_open)
    app.register_blueprint(blueprint=api_halo)

    # 静态上传文件访问
    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        return send_from_directory(config.UPLOAD_PATH, filename)

    # 静态临时/缓存文件访问 (temp/images)
    @app.route('/temp/images/<path:filename>')
    def cached_temp_image(filename):
        return send_from_directory(config.CACHE_IMAGE_DIR, filename)

    # 全局请求生命周期日志跟踪 (分类输出至 logs/api.log)
    @app.before_request
    def log_before_request():
        g.request_start_time = time.time()

    @app.after_request
    def log_after_request(response):
        # 仅针对 API 接口与上传接口记录访问审计日志，过滤静态探针刷屏
        if request.path.startswith(('/api/', '/apis/')):
            duration_ms = (time.time() - getattr(g, 'request_start_time', time.time())) * 1000
            status_code = response.status_code
            log_msg = f"{request.remote_addr} - [{request.method}] {request.path} {status_code} ({duration_ms:.1f}ms)"
            if status_code >= 500:
                api_logger.error(log_msg)
            elif status_code >= 400:
                api_logger.warning(log_msg)
            else:
                api_logger.info(log_msg)
        return response

    @app.errorhandler(Exception)
    def handle_global_exception(error):
        app_logger.error(f"全局未捕获异常 [{request.method} {request.path}]: {str(error)}", exc_info=True)
        api_logger.error(f"API 异常终止 [{request.method} {request.path}]: {str(error)}")
        return jsonify({'msg': '服务器内部处理异常，详情请查看后台日志'}), 500

    # 注册DB数据库
    app.config.from_object(config)
    app.secret_key = config.SECRET_KEY
    app.permanent_session_lifetime = datetime.timedelta(days=7)

    init_exts(app=app)

    # 启动后台 AI 自动化提取与摘要调度任务
    from .tools.ai_scheduler import start_ai_scheduler
    start_ai_scheduler(app=app)

    app_logger.info("AeroNote 所有组件与后台任务装载完毕，开始处理网络请求。")
    return app

