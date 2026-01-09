from flask import Blueprint, jsonify, request
import copy
from metrics_store import metrics_store

settings_bp = Blueprint("settings", __name__)

DEFAULT_SETTINGS = {
    "profile": {
        "username": "admin",
        "email": "admin@nethawk.local",
        "organization": "NetHawk Security",
        "timezone": "utc"
    },
    "network": {
        "default_interface": "eth0",
        "default_range": "192.168.1.0/24"
    },
    "appearance": {
        "theme": "dark",
        "compact_mode": False,
        "animations": True,
        "auto_collapse_sidebar": True,
        "default_view": "overview"
    },
    "notifications": {
        "email": True,
        "desktop": True,
        "sound": False,
        "security": True
    },
    "thresholds": {
        "cpu": 80,
        "memory": 85,
        "bandwidth": 100,
        "disk": 90
    },
    "security": {
        "two_factor": False,
        "session_timeout": "30",
        "audit_logging": True,
        "allowed_ips": "0.0.0.0/0",
        "api_access": False
    },
    "advanced": {
        "scan_timeout": 30,
        "scan_threads": 10,
        "scan_retries": 3,
        "auto_save": True,
        "retention_days": "30",
        "export_format": "json",
        "db_cleanup": True
    }
}


@settings_bp.route("/", methods=["GET"])
def get_settings():
    saved = metrics_store.get_settings()
    if not saved:
        metrics_store.set_settings(DEFAULT_SETTINGS)
        saved = DEFAULT_SETTINGS
    return jsonify(saved)


@settings_bp.route("/", methods=["POST"])
def save_settings():
    payload = request.json or {}
    merged = copy.deepcopy(DEFAULT_SETTINGS)
    for section, values in payload.items():
        if isinstance(values, dict):
            merged.setdefault(section, {})
            merged[section].update(values)
    metrics_store.set_settings(merged)
    return jsonify({"success": True, "settings": merged})
