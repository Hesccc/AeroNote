import time
import threading
from typing import Any, Callable

# ─── 轻量级线程安全内存缓存 (带 TTL 过期与前缀分组驱逐) ───

class SimpleMemoryCache:
    def __init__(self, default_ttl: int = 60, max_keys: int = 1000):
        self.default_ttl = default_ttl
        self.max_keys = max_keys
        self._store: dict[str, tuple[Any, float]] = {}  # key -> (data, expire_at)
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        now = time.time()
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            data, expire_at = item
            if now > expire_at:
                self._store.pop(key, None)
                return None
            return data

    def set(self, key: str, data: Any, ttl: int | None = None):
        expire_at = time.time() + (ttl if ttl is not None else self.default_ttl)
        with self._lock:
            # 简单 LRU / 容量控制：超限时剔除已过期项
            if len(self._store) >= self.max_keys:
                now = time.time()
                expired = [k for k, (_, exp) in self._store.items() if now > exp]
                for k in expired:
                    self._store.pop(k, None)
                # 依然超限则截断一半
                if len(self._store) >= self.max_keys:
                    excess = len(self._store) - (self.max_keys // 2)
                    for k in list(self._store.keys())[:excess]:
                        self._store.pop(k, None)

            self._store[key] = (data, expire_at)

    def delete(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def clear_prefix(self, prefix: str):
        """批量清理指定前缀的缓存（如 'posts:', 'categories:'）。"""
        with self._lock:
            matched = [k for k in self._store.keys() if k.startswith(prefix)]
            for k in matched:
                self._store.pop(k, None)

    def clear_all(self):
        with self._lock:
            self._store.clear()


# 全局缓存单例
api_cache = SimpleMemoryCache(default_ttl=60, max_keys=1000)


def invalidate_posts_cache():
    """文章变更时驱逐所有文章列表与详情缓存。"""
    api_cache.clear_prefix('posts:')
    api_cache.clear_prefix('post:')


def invalidate_taxonomy_cache():
    """分类或标签变更时驱逐分类、标签及文章关联缓存。"""
    api_cache.clear_prefix('categories:')
    api_cache.clear_prefix('tags:')
    api_cache.clear_prefix('posts:')


def invalidate_all_cache():
    """全量清理所有内容读缓存。"""
    api_cache.clear_all()
