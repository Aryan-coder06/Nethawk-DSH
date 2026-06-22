import time
import psutil
from flask import Blueprint, jsonify
from core.latency import latency_settings, measure_latency
from metrics_store import metrics_store

notifications_bp = Blueprint("notifications", __name__)
_last_alert_times = {}


def _record_alert_once(alert_type: str, message: str, cooldown_seconds: int = 300) -> None:
    now = int(time.time())
    last_seen = _last_alert_times.get(alert_type, 0)
    if now - last_seen >= cooldown_seconds:
        metrics_store.add_activity("alert", message, "warning", alert_type=alert_type)
        _last_alert_times[alert_type] = now


@notifications_bp.route("/", methods=["GET"])
def get_notifications():
    settings = metrics_store.get_settings()
    thresholds = settings.get("thresholds", {})

    cpu_threshold = thresholds.get("cpu", 80)
    memory_threshold = thresholds.get("memory", 85)
    disk_threshold = thresholds.get("disk", 90)
    bandwidth_threshold = thresholds.get("bandwidth", 100)
    latency_threshold = thresholds.get("latency", 250)

    notifications = []
    now = int(time.time())

    cpu = psutil.cpu_percent(interval=0.2)
    memory = psutil.virtual_memory().percent
    du = psutil.disk_usage("/")
    disk = round((du.used / du.total) * 100, 2)

    if cpu >= cpu_threshold:
        item = {
            "id": f"cpu-{now}",
            "type": "cpu",
            "level": "warning",
            "message": f"CPU usage high: {cpu}%",
            "timestamp": now
        }
        notifications.append(item)
        _record_alert_once("cpu", item["message"])

    if memory >= memory_threshold:
        item = {
            "id": f"memory-{now}",
            "type": "memory",
            "level": "warning",
            "message": f"Memory usage high: {memory}%",
            "timestamp": now
        }
        notifications.append(item)
        _record_alert_once("memory", item["message"])

    if disk >= disk_threshold:
        item = {
            "id": f"disk-{now}",
            "type": "disk",
            "level": "warning",
            "message": f"Disk usage high: {disk}%",
            "timestamp": now
        }
        notifications.append(item)
        _record_alert_once("disk", item["message"])

    history = metrics_store.get_bandwidth_history()
    if history:
        latest = history[-1]
        bandwidth = latest.get("download", 0) + latest.get("upload", 0)
        if bandwidth >= bandwidth_threshold:
            item = {
                "id": f"bandwidth-{now}",
                "type": "bandwidth",
                "level": "warning",
                "message": f"Bandwidth spike: {bandwidth} Mbps",
                "timestamp": now
            }
            notifications.append(item)
            _record_alert_once("bandwidth", item["message"])

    target, port = latency_settings(settings)
    latency = measure_latency(target=target, port=port, timeout=1.0)
    latency_ms = latency.get("latency_ms")
    if latency["status"] != "ok" or (latency_ms is not None and latency_ms >= latency_threshold):
        message = (
            f"Latency degraded: {latency_ms} ms to {target}"
            if latency_ms is not None
            else f"Latency unavailable: {target}"
        )
        item = {
            "id": f"latency-{now}",
            "type": "latency",
            "level": "warning",
            "message": message,
            "timestamp": now
        }
        notifications.append(item)
        _record_alert_once("latency", item["message"])

    return jsonify({"count": len(notifications), "notifications": notifications})
