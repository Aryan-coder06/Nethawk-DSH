import json
import os
import time
from collections import deque
from pathlib import Path
from tempfile import NamedTemporaryFile

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None


class MetricsStore:
    def __init__(self, local_file: str | Path | None = None) -> None:
        self._redis = None
        self._history = deque(maxlen=43200)  # 24h at 2s intervals
        self._interface_snapshot = []
        self._settings = {}
        self._activities = deque(maxlen=100)
        self._prefix = os.getenv("NETHAWK_REDIS_PREFIX", "nethawk")
        self._local_file = Path(
            local_file
            or os.getenv(
                "NETHAWK_LOCAL_STORE",
                Path(__file__).resolve().parent / ".nethawk" / "store.json",
            )
        )

        redis_url = os.getenv("REDIS_URL")
        if redis_url and redis is not None:
            try:
                client = redis.Redis.from_url(redis_url, decode_responses=True)
                client.ping()
                self._redis = client
            except Exception:
                self._redis = None

        if not self._redis:
            self._load_local_state()

    def _key(self, suffix: str) -> str:
        return f"{self._prefix}:{suffix}"

    def _load_local_state(self) -> None:
        if not self._local_file.exists():
            return
        try:
            with self._local_file.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            if not isinstance(data, dict):
                return
            settings = data.get("settings", {})
            activities = data.get("activities", [])
            self._settings = settings if isinstance(settings, dict) else {}
            self._activities = deque(activities if isinstance(activities, list) else [], maxlen=100)
        except (OSError, json.JSONDecodeError):
            self._settings = {}
            self._activities = deque(maxlen=100)

    def _save_local_state(self) -> None:
        if self._redis:
            return
        try:
            self._local_file.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "settings": self._settings,
                "activities": list(self._activities),
            }
            with NamedTemporaryFile(
                "w",
                encoding="utf-8",
                dir=self._local_file.parent,
                delete=False,
                prefix=f".{self._local_file.name}.",
                suffix=".tmp",
            ) as fh:
                json.dump(payload, fh, indent=2)
                tmp_name = fh.name
            Path(tmp_name).replace(self._local_file)
        except OSError:
            # Persistence should never take down live monitoring.
            return

    def get_persistence_mode(self) -> str:
        return "redis" if self._redis else "local_json"

    def get_local_store_path(self) -> str:
        return str(self._local_file)

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

    def set_settings(self, settings: dict) -> dict:
        settings = dict(settings)
        settings["updated_at"] = int(time.time())
        if self._redis:
            key = self._key("settings")
            self._redis.set(key, json.dumps(settings))
        else:
            self._settings = settings
            self._save_local_state()
        return settings

    def get_settings(self) -> dict:
        if self._redis:
            key = self._key("settings")
            raw = self._redis.get(key)
            return json.loads(raw) if raw else {}
        return self._settings

    def add_activity(self, activity_type: str, message: str, status: str = "info", **extra: object) -> dict:
        now = int(time.time())
        activity = {
            "id": f"{activity_type}-{now}-{len(self._activities)}",
            "type": activity_type,
            "message": message,
            "status": status,
            "timestamp": now,
            "time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now)),
            **extra,
        }
        if self._redis:
            key = self._key("activities")
            self._redis.lpush(key, json.dumps(activity))
            self._redis.ltrim(key, 0, 99)
        else:
            self._activities.appendleft(activity)
            self._save_local_state()
        return activity

    def get_activities(self, limit: int = 10) -> list[dict]:
        limit = max(1, min(limit, 100))
        if self._redis:
            key = self._key("activities")
            raw = self._redis.lrange(key, 0, limit - 1)
            return [json.loads(item) for item in raw]
        return list(self._activities)[:limit]


metrics_store = MetricsStore()
