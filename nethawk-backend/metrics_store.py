import json
import os
import time
from collections import deque

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None


class MetricsStore:
    def __init__(self) -> None:
        self._redis = None
        self._history = deque(maxlen=43200)  # 24h at 2s intervals
        self._interface_snapshot = []
        self._settings = {}
        self._prefix = os.getenv("NETHAWK_REDIS_PREFIX", "nethawk")

        redis_url = os.getenv("REDIS_URL")
        if redis_url and redis is not None:
            try:
                client = redis.Redis.from_url(redis_url, decode_responses=True)
                client.ping()
                self._redis = client
            except Exception:
                self._redis = None

    def _key(self, suffix: str) -> str:
        return f"{self._prefix}:{suffix}"

    def add_bandwidth_point(self, point: dict) -> None:
        if self._redis:
            key = self._key("bandwidth_history")
            self._redis.rpush(key, json.dumps(point))
            self._redis.ltrim(key, -43200, -1)
        else:
            self._history.append(point)

    def get_bandwidth_history(self) -> list[dict]:
        if self._redis:
            key = self._key("bandwidth_history")
            raw = self._redis.lrange(key, 0, -1)
            return [json.loads(item) for item in raw]
        return list(self._history)

    def set_interface_snapshot(self, interfaces: list[dict]) -> None:
        if self._redis:
            key = self._key("interface_usage")
            self._redis.set(key, json.dumps(interfaces))
        else:
            self._interface_snapshot = interfaces

    def get_interface_snapshot(self) -> list[dict]:
        if self._redis:
            key = self._key("interface_usage")
            raw = self._redis.get(key)
            return json.loads(raw) if raw else []
        return self._interface_snapshot

    def set_settings(self, settings: dict) -> None:
        settings["updated_at"] = int(time.time())
        if self._redis:
            key = self._key("settings")
            self._redis.set(key, json.dumps(settings))
        else:
            self._settings = settings

    def get_settings(self) -> dict:
        if self._redis:
            key = self._key("settings")
            raw = self._redis.get(key)
            return json.loads(raw) if raw else {}
        return self._settings


metrics_store = MetricsStore()
