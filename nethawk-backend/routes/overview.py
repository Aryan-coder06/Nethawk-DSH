from flask import Blueprint, jsonify, current_app
import psutil, shutil, time

ov_bp = Blueprint("overview", __name__)

# Global buffer to simulate real-time traffic history
traffic_data = []

@ov_bp.route("/stats", methods=["GET"])
def stats():
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory().percent
    du = shutil.disk_usage("/")
    disk = round((du.used / du.total) * 100, 2)

    # simple network load as % of arbitrary cap
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

    # Keep only the last 7 entries
    if len(traffic_data) > 7:
        traffic_data.pop(0)

    return jsonify(traffic_data)


@ov_bp.route("/devices", methods=["GET"])
def devices():
    return jsonify(current_app.config.get("DEVICES", [
        {"name": "Computers", "value": 8, "color": "#0ea5e9"},
        {"name": "Mobile", "value": 12, "color": "#22c55e"},
        {"name": "IoT", "value": 6, "color": "#f59e0b"},
        {"name": "Servers", "value": 3, "color": "#ef4444"}
    ]))


@ov_bp.route("/activity", methods=["GET"])
def activity():
    return jsonify([
        {"id": 1, "type": "scan", "message": "Port scan on 192.168.1.1", "time": "2 min ago", "status": "success"},
        {"id": 2, "type": "alert", "message": "High bandwidth usage", "time": "5 min ago", "status": "warning"},
        {"id": 3, "type": "connection", "message": "New device connected", "time": "8 min ago", "status": "info"},
        {"id": 4, "type": "security", "message": "Firewall blocked suspicious", "time": "12 min ago", "status": "success"}
    ])
