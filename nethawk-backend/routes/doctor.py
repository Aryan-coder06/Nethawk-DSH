import shutil
import time

import psutil
from flask import Blueprint, jsonify

from core.diagnosis_engine import generate_diagnosis
from core.latency import latency_settings, measure_latency
from metrics_store import metrics_store


doctor_bp = Blueprint("doctor", __name__)
_last_doctor_status = None


def _latest_bandwidth_metrics() -> dict:
    history = metrics_store.get_bandwidth_history()
    latest = history[-1] if history else {}
    return {
        "upload": latest.get("upload", 0),
        "download": latest.get("download", 0),
        "network": latest.get("upload", 0) + latest.get("download", 0),
    }


def _current_metrics() -> dict:
    du = shutil.disk_usage("/")
    bandwidth = _latest_bandwidth_metrics()
    return {
        "cpu": psutil.cpu_percent(interval=0.2),
        "memory": psutil.virtual_memory().percent,
        "disk": round((du.used / du.total) * 100, 2),
        **bandwidth,
    }


def _latest_scan_result(activities: list[dict]) -> dict | None:
    # Full scan history can improve this later. For now the doctor uses the
    # latest completed scan activity if it contains open_ports.
    for activity in activities:
        if activity.get("type") == "scan" and isinstance(activity.get("open_ports"), list):
            return {
                "host": activity.get("host"),
                "ports": activity.get("ports"),
                "open_ports": activity.get("open_ports", []),
                "timestamp": activity.get("timestamp"),
            }
    return None


def _record_status_change(status: str) -> None:
    global _last_doctor_status
    if status == _last_doctor_status:
        return

    previous = _last_doctor_status
    _last_doctor_status = status
    if previous is not None and status != "healthy":
        metrics_store.add_activity(
            "doctor",
            f"Network Doctor status changed from {previous} to {status}",
            "warning" if status == "warning" else status,
            previous_status=previous,
            current_status=status,
        )


@doctor_bp.route("/doctor", methods=["GET"])
@doctor_bp.route("/diagnosis", methods=["GET"])
def doctor():
    settings = metrics_store.get_settings()
    target, port = latency_settings(settings)
    latency = measure_latency(target=target, port=port, timeout=1.0)
    activities = metrics_store.get_activities(limit=25)

    result = generate_diagnosis(
        metrics=_current_metrics(),
        latency=latency,
        activities=activities,
        scan_result=_latest_scan_result(activities),
        settings=settings,
    )
    result["source"] = {
        "metrics": "psutil",
        "latency": "tcp_connect",
        "activity_count": len(activities),
        "timestamp": int(time.time()),
    }

    _record_status_change(result["overall_status"])
    return jsonify(result)
