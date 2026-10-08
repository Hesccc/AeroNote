import os
import sys
import time
import shutil
import tarfile
import threading
from pathlib import Path
from datetime import datetime, date, timedelta
import logging
from logging.handlers import TimedRotatingFileHandler

# 项目根目录与日志根目录 (./logs)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
LOGS_DIR = (BASE_DIR / 'logs').resolve()
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# 统一日志格式：包含时间戳、日志级别、模块名、源代码位置及日志信息
DEFAULT_LOG_FORMAT = '[%(asctime)s] [%(levelname)s] [%(name)s] [%(filename)s:%(lineno)d] - %(message)s'
DEFAULT_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# 线程锁，保证多线程环境下文件归档操作的原子性
_ARCHIVE_LOCK = threading.Lock()
_LOGGER_CACHE = {}


def _safe_rotate_file(src: Path, dst: Path):
    """
    跨平台（Windows / Linux）安全重命名并移交日志文件：
    优先尝试原子 rename，若遇到 Windows 句柄锁则带重试并平滑降级为复制后清空截断。
    """
    if dst.exists():
        try:
            dst.unlink()
        except Exception:
            pass

    for attempt in range(5):
        try:
            src.rename(dst)
            return
        except PermissionError:
            time.sleep(0.05)

    # 降级方案：复制到目标路径并清空源文件
    shutil.copy2(src, dst)
    try:
        with open(src, 'w', encoding='utf-8') as f:
            f.truncate(0)
    except Exception:
        pass


def _compress_log_to_tgz(log_file_path: Path, tgz_file_path: Path, arc_name: str) -> bool:
    """
    将指定的单个 .log 文件压缩打包为 .log.tgz 文件，并在压缩成功后删除原始未压缩的 .log 文件。
    """
    try:
        with tarfile.open(tgz_file_path, mode='w:gz') as tar:
            tar.add(log_file_path, arcname=arc_name)
        # 压缩成功后删除未压缩日志
        if log_file_path.exists():
            log_file_path.unlink()
        return True
    except Exception as e:
        sys.stderr.write(f"[Logger] 归档压缩日志失败 {log_file_path.name} -> {tgz_file_path.name}: {e}\n")
        return False


def archive_historical_logs(logs_dir: Path = LOGS_DIR):
    """
    启动时或定时检查冷启动残留历史日志：
    若当前分类日志文件 (如 api.log) 最后修改时间早于今天，则将其归档压缩为 日志分类_YYYYMMDD.log.tgz
    保证当天写入的文件始终是 日志分类.log。
    """
    with _ARCHIVE_LOCK:
        try:
            today = date.today()
            for log_file in logs_dir.glob('*.log'):
                if not log_file.is_file():
                    continue
                # 获取该日志文件的最后修改日期
                mtime = log_file.stat().st_mtime
                file_date = datetime.fromtimestamp(mtime).date()

                # 如果日志修改日期早于今天且文件不为空，执行归档压缩
                if file_date < today and log_file.stat().st_size > 0:
                    category = log_file.stem
                    date_str = file_date.strftime('%Y%m%d')
                    target_archive_name = f"{category}_{date_str}.log"
                    target_tgz_name = f"{category}_{date_str}.log.tgz"

                    temp_archive_path = logs_dir / target_archive_name
                    tgz_path = logs_dir / target_tgz_name

                    # 安全轮转重命名并打包
                    try:
                        _safe_rotate_file(log_file, temp_archive_path)
                        _compress_log_to_tgz(temp_archive_path, tgz_path, target_archive_name)
                    except Exception as err:
                        sys.stderr.write(f"[Logger] 历史日志重命名归档失败 {log_file.name}: {err}\n")
        except Exception as e:
            sys.stderr.write(f"[Logger] 检查历史日志异常: {e}\n")


class DailyArchivedRotatingFileHandler(TimedRotatingFileHandler):
    """
    按天切分并在切分时自动重命名并压缩为 `日志分类_YYYYMMDD.log.tgz` 的专用日志处理器：
    1. 当天日志文件名称始终为 `日志分类.log` (例如 `api.log`)
    2. 跨天发生轮转时，将前一天日志重命名为 `日志分类_YYYYMMDD.log` 并压缩为 `日志分类_YYYYMMDD.log.tgz`
    3. 压缩完毕后安全移除未压缩日志文件
    """

    def __init__(self, category: str, log_dir: Path = LOGS_DIR, encoding: str = 'utf-8'):
        self.category = category
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        # 当天的日志文件名：日志分类.log
        base_log_path = self.log_dir / f"{category}.log"

        super().__init__(
            filename=str(base_log_path),
            when='midnight',
            interval=1,
            backupCount=0,
            encoding=encoding,
            delay=False,
            utc=False
        )

    def doRollover(self):
        """执行日志跨天轮转与归档压缩"""
        with _ARCHIVE_LOCK:
            self.close()

            current_file = Path(self.baseFilename)
            if current_file.exists() and current_file.stat().st_size > 0:
                # 计算归档日期（优先从文件修改时间，兜底为昨天）
                try:
                    mtime = current_file.stat().st_mtime
                    file_date = datetime.fromtimestamp(mtime).date()
                except Exception:
                    file_date = date.today() - timedelta(days=1)

                date_str = file_date.strftime('%Y%m%d')
                archive_log_name = f"{self.category}_{date_str}.log"
                archive_tgz_name = f"{self.category}_{date_str}.log.tgz"

                temp_log_path = self.log_dir / archive_log_name
                target_tgz_path = self.log_dir / archive_tgz_name

                try:
                    # 1. 跨平台安全重命名并移交
                    _safe_rotate_file(current_file, temp_log_path)

                    # 2. 压缩为 .log.tgz 并删除临时未压缩文件
                    _compress_log_to_tgz(temp_log_path, target_tgz_path, archive_log_name)
                except Exception as e:
                    sys.stderr.write(f"[Logger] 轮转归档文件异常 {self.category}: {e}\n")

            # 3. 重新打开当天的日志文件
            if not self.delay:
                self.stream = self._open()

            # 4. 重新计算下一次午夜轮转时间
            currentTime = int(time.time())
            newRolloverAt = self.computeRollover(currentTime)
            while newRolloverAt <= currentTime:
                newRolloverAt = newRolloverAt + self.interval
            self.rolloverAt = newRolloverAt


def get_log_level() -> int:
    """从环境变量获取日志等级，默认为 INFO"""
    level_str = os.getenv('LOG_LEVEL', 'INFO').upper().strip()
    return getattr(logging, level_str, logging.INFO)


def get_module_logger(category: str = 'app') -> logging.Logger:
    """
    按模块分类获取对应的日志记录器 Logger：
    每类日志文件独立存储在 ./logs/{category}.log 中。
    支持按 INFO - ERROR 标准日志级别记录输出，跨天自动归档压缩为 {category}_YYYYMMDD.log.tgz。
    """
    clean_category = category.lower().strip() or 'app'
    logger_name = f"aeronote.{clean_category}"

    if logger_name in _LOGGER_CACHE:
        return _LOGGER_CACHE[logger_name]

    logger = logging.getLogger(logger_name)
    logger.setLevel(get_log_level())
    logger.propagate = False  # 防止向 root logger 重复冒泡输出

    formatter = logging.Formatter(fmt=DEFAULT_LOG_FORMAT, datefmt=DEFAULT_DATE_FORMAT)

    # 1. 配置文件处理器（按模块分类独立写入 ./logs/{category}.log 并支持自动归档）
    file_handler = DailyArchivedRotatingFileHandler(category=clean_category, log_dir=LOGS_DIR)
    file_handler.setLevel(get_log_level())
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # 2. 控制台输出处理器 (标准输出，便于开发与 docker 容器实时监控)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(get_log_level())
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    _LOGGER_CACHE[logger_name] = logger
    return logger


# 预置常用业务模块的分类日志记录器
app_logger = get_module_logger('app')          # 系统启动、数据库生命周期、全局未捕获异常
api_logger = get_module_logger('api')          # Web API 请求访问、路由处理与业务状态
scheduler_logger = get_module_logger('scheduler')  # 后台定时调度器 (AI Scheduler) 执行过程与结果
llm_logger = get_module_logger('llm')          # 大模型请求调用、交互与耗时日志
