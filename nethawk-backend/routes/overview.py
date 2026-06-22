from flask import Blueprint, jsonify, request
import psutil, shutil, time
from metrics_store import metrics_store

ov_bp = Blueprint("overview", __name__)

traffic_data = []

@ov_bp.route("/stats", methods=["GET"])
def stats():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory().percent
    du = shutil.disk_usage("/")
    disk = round((du.used / du.total) * 100, 2)

    counters = psutil.net_io_counters()
    net_mb = (counters.bytes_sent + counters.bytes_recv) / (1024 * 1024)
    network = min(net_mb, 100)
    return jsonify({
        "cpu": cpu,
        "memory": mem,
        "disk": disk,
        "network": network
    })


@ov_bp.route("/traffic", methods=["GET"])
def traffic():
    counters = psutil.net_io_counters()
    upload = round(counters.bytes_sent / (1024 * 1024), 2)
    download = round(counters.bytes_recv / (1024 * 1024), 2)
    current_time = time.strftime("%H:%M", time.localtime())

    traffic_data.append({
        "time": current_time,
        "upload": upload,
        "download": download
    })

    if len(traffic_data) > 7:
        traffic_data.pop(0)

    return jsonify(traffic_data)


@ov_bp.route("/devices", methods=["GET"])
def devices():
    stats = psutil.net_if_stats()
    counts = {
        "Ethernet": 0,
        "Wi-Fi": 0,
        "Loopback": 0,
        "Virtual/Other": 0
    }

    for name in stats.keys():
        lower = name.lower()
        if lower.startswith("lo"):
            counts["Loopback"] += 1
        elif any(token in lower for token in ["wifi", "wi-fi", "wlan", "wl"]):
            counts["Wi-Fi"] += 1
        elif any(token in lower for token in ["eth", "enp", "eno", "ens"]):
            counts["Ethernet"] += 1
        else:
            counts["Virtual/Other"] += 1

    palette = {
        "Ethernet": "#0ea5e9",
        "Wi-Fi": "#22c55e",
        "Loopback": "#f59e0b",
        "Virtual/Other": "#8b5cf6"
    }

    data = [
        {"name": name, "value": value, "color": palette[name]}
        for name, value in counts.items()
        if value > 0
    ]
    return jsonify(data)



@ov_bp.route("/activity", methods=["GET"])
def activity():
    limit = request.args.get("limit", default=10, type=int)
    return jsonify(metrics_store.get_activities(limit=limit))
