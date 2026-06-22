import shutil
import time
from datetime import datetime

import psutil

from core.diagnosis_engine import generate_diagnosis
from core.latency import latency_settings, measure_latency
from metrics_store import metrics_store

_last_net_sample: tuple[float, object] | None = None
_last_latency: dict | None = None
_last_latency_at = 0.0


def _bandwidth_sample() -> tuple[float, float]:
    global _last_net_sample
    now = time.perf_counter()
    counters = psutil.net_io_counters()

    if _last_net_sample is None:
        _last_net_sample = (now, counters)
        return 0.0, 0.0

    previous_time, previous_counters = _last_net_sample
    elapsed = max(now - previous_time, 0.1)
    _last_net_sample = (now, counters)

    sent_delta = max(0, counters.bytes_sent - previous_counters.bytes_sent)
    recv_delta = max(0, counters.bytes_recv - previous_counters.bytes_recv)
    upload = round(((sent_delta / elapsed) * 8) / (1024 * 1024), 2)
    download = round(((recv_delta / elapsed) * 8) / (1024 * 1024), 2)
    return upload, download


def _latency_sample(force: bool = False) -> dict:
    global _last_latency, _last_latency_at
    now = time.perf_counter()
    if not force and _last_latency is not None and now - _last_latency_at < 3:
        return {**_last_latency, "cached": True}

    settings = metrics_store.get_settings()
    target, port = latency_settings(settings)
    _last_latency = measure_latency(target=target, port=port, timeout=0.35)
    _last_latency["cached"] = False
    _last_latency_at = now
    return _last_latency


def collect_dashboard_snapshot(force_latency: bool = False) -> dict:
    upload, download = _bandwidth_sample()
    disk = shutil.disk_usage("/")
    latency = _latency_sample(force=force_latency)

    return {
        "cpu": psutil.cpu_percent(interval=None),
        "memory": psutil.virtual_memory().percent,
        "disk": round((disk.used / disk.total) * 100, 2),
        "upload": upload,
        "download": download,
        "latency": latency,
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "timestamp": int(time.time()),
    }


def collect_doctor_snapshot(force_latency: bool = False) -> dict:
    dashboard = collect_dashboard_snapshot(force_latency=force_latency)
    settings = metrics_store.get_settings()
    activities = metrics_store.get_activities(limit=25)
    scan_result = latest_scan_result(activities)

    result = generate_diagnosis(
        metrics={
            "cpu": dashboard["cpu"],
            "memory": dashboard["memory"],
            "disk": dashboard["disk"],
            "upload": dashboard["upload"],
            "download": dashboard["download"],
            "network": dashboard["upload"] + dashboard["download"],
        },
        latency=dashboard["latency"],
        activities=activities,
        scan_result=scan_result,
        settings=settings,
    )
    result["dashboard"] = dashboard
    return result


def latest_scan_result(activities: list[dict]) -> dict | None:
    for activity in activities:
        if activity.get("type") == "scan" and isinstance(activity.get("open_ports"), list):
            return {
                "host": activity.get("host"),
                "ports": activity.get("ports"),
                "open_ports": activity.get("open_ports", []),
            }
    return None


def recent_activities(limit: int = 12) -> list[dict]:
    return metrics_store.get_activities(limit=limit)


def current_settings() -> dict:
    settings = metrics_store.get_settings()
    if not settings:
        settings = {}
    return settings


def save_tui_settings(values: dict) -> tuple[bool, str, dict]:
    settings = current_settings()
    network = dict(settings.get("network", {}))
    thresholds = dict(settings.get("thresholds", {}))

    try:
        latency_port = int(values["latency_port"])
        cpu = int(values["cpu"])
        memory = int(values["memory"])
        latency = int(values["latency"])
    except (KeyError, TypeError, ValueError):
        return False, "Settings must use numeric values for ports and thresholds.", settings

    if not 1 <= latency_port <= 65535:
        return False, "Latency port must be between 1 and 65535.", settings
    if not 1 <= cpu <= 100 or not 1 <= memory <= 100:
        return False, "CPU and memory thresholds must be between 1 and 100.", settings
    if not 1 <= latency <= 5000:
        return False, "Latency threshold must be between 1 and 5000 ms.", settings

    network["latency_target"] = values.get("latency_target", "8.8.8.8").strip() or "8.8.8.8"
    network["latency_port"] = latency_port
    thresholds["cpu"] = cpu
    thresholds["memory"] = memory
    thresholds["latency"] = latency

    settings["network"] = network
    settings["thresholds"] = thresholds
    saved = metrics_store.set_settings(settings)
    metrics_store.add_activity("settings", "TUI settings updated", "success", source="tui")
    return True, "Settings saved", saved


def format_uptime(seconds: int) -> str:
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    if days:
        return f"{days}d {hours}h {minutes}m"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


def format_time(timestamp: int | None = None) -> str:
    value = datetime.fromtimestamp(timestamp or time.time())
    return value.strftime("%H:%M:%S")
