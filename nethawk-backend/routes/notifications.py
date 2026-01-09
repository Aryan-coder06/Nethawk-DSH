import time
import psutil
from flask import Blueprint, jsonify
from metrics_store import metrics_store

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.route("/", methods=["GET"])
def get_notifications():
    settings = metrics_store.get_settings()
    thresholds = settings.get("thresholds", {})

    cpu_threshold = thresholds.get("cpu", 80)
    memory_threshold = thresholds.get("memory", 85)
    disk_threshold = thresholds.get("disk", 90)
    bandwidth_threshold = thresholds.get("bandwidth", 100)

    notifications = []
    now = int(time.time())

    cpu = psutil.cpu_percent(interval=0.2)
    memory = psutil.virtual_memory().percent
    du = psutil.disk_usage("/")
    disk = round((du.used / du.total) * 100, 2)

    if cpu >= cpu_threshold:
        notifications.append({
            "id": f"cpu-{now}",
            "type": "cpu",
            "level": "warning",
            "message": f"CPU usage high: {cpu}%",
            "timestamp": now
        })

    if memory >= memory_threshold:
        notifications.append({
            "id": f"memory-{now}",
            "type": "memory",
            "level": "warning",
            "message": f"Memory usage high: {memory}%",
            "timestamp": now
        })

    if disk >= disk_threshold:
        notifications.append({
            "id": f"disk-{now}",
            "type": "disk",
            "level": "warning",
            "message": f"Disk usage high: {disk}%",
            "timestamp": now
        })

    history = metrics_store.get_bandwidth_history()
    if history:
        latest = history[-1]
        bandwidth = latest.get("download", 0) + latest.get("upload", 0)
        if bandwidth >= bandwidth_threshold:
            notifications.append({
                "id": f"bandwidth-{now}",
                "type": "bandwidth",
                "level": "warning",
                "message": f"Bandwidth spike: {bandwidth} Mbps",
                "timestamp": now
            })

    return jsonify({"count": len(notifications), "notifications": notifications})
