# from flask import Blueprint, jsonify, request, current_app
# from ftplib import FTP
# from utils import parse_ftp_list

# ftp_bp = Blueprint("ftp", __name__)

# @ftp_bp.route("/connections", methods=["GET"])
# def connections():
#     return jsonify(current_app.config["FTP_CONNECTIONS"])

# @ftp_bp.route("/files", methods=["POST"])
# def list_files():
#     data = request.json
#     conn = next(c for c in current_app.config["FTP_CONNECTIONS"] if c["id"] == data["id"])
#     ftp = FTP()
#     ftp.connect(conn["host"], conn["port"], timeout=5)
#     ftp.login(conn["username"], data.get("password", ""))
#     lines = []
#     ftp.retrlines(f"LIST {data.get('path','/')}", lines.append)
#     ftp.quit()
#     return jsonify(parse_ftp_list(lines))








# backend/routes/ftp.py
# This blueprint now primarily serves initial FTP connection profiles via HTTP.
# All real-time FTP operations are handled via Socket.IO in app.py.

from flask import Blueprint, jsonify, current_app
# No longer need FTP, request, parse_ftp_list here as logic moved to app.py
# from ftplib import FTP
# from utils import parse_ftp_list

ftp_bp = Blueprint("ftp", __name__)

@ftp_bp.route("/connections", methods=["GET"])
def connections():
    """
    Returns the list of configured FTP connection profiles.
    This is a standard HTTP GET endpoint, used for initial loading
    of available FTP servers.
    """
    # current_app will access the FTP_CONNECTIONS set in app.py
    return jsonify(current_app.config.get("FTP_CONNECTIONS", []))

# The /files HTTP POST route is removed as file listing is now handled
# by Socket.IO's 'ftp_list_dir' event.
# @ftp_bp.route("/files", methods=["POST"])
# def list_files():
#     # This logic has been moved to app.py under the 'ftp_list_dir' Socket.IO event.
#     pass