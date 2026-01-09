from flask import Blueprint, jsonify, request
from metrics_store import metrics_store

bandwidth_api_bp = Blueprint("bandwidth_api", __name__)


@bandwidth_api_bp.route("/history", methods=["GET"])
def bandwidth_history():
    """
    Returns stored bandwidth history points.
    """
    history = metrics_store.get_bandwidth_history()
    limit = request.args.get("limit", type=int)
    if limit:
        history = history[-limit:]
    return jsonify(history)


@bandwidth_api_bp.route("/interfaces", methods=["GET"])
def bandwidth_interfaces():
    """
    Returns latest per-interface usage snapshot.
    """
    interfaces = metrics_store.get_interface_snapshot()
    return jsonify(interfaces)
