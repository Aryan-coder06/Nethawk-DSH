import time

from flask import Blueprint, jsonify

from core.latency import latency_settings, measure_latency
from metrics_store import metrics_store


health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
@health_bp.route("/status", methods=["GET"])
def health():
    settings = metrics_store.get_settings()
    target, port = latency_settings(settings)
    latency = measure_latency(target=target, port=port, timeout=1.0)

    return jsonify({
        "status": "ok",
        "timestamp": int(time.time()),
        "version": "1.0.0",
        "persistence": {
            "mode": metrics_store.get_persistence_mode(),
            "path": metrics_store.get_local_store_path() if metrics_store.get_persistence_mode() == "local_json" else None,
        },
        "latency": latency,
    })
