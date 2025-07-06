# from flask import Blueprint, jsonify
# import psutil, time

# bw_bp = Blueprint("bandwidth", __name__)
# _last, _last_t = psutil.net_io_counters(), time.time()

# @bw_bp.route("/", methods=["GET"])
# def get_bw():
#     global _last, _last_t
#     now = time.time()
#     cur = psutil.net_io_counters()
#     elapsed = now - _last_t or 1

#     # Calculate bytes per second
#     sent = (cur.bytes_sent - _last.bytes_sent) / elapsed
#     recv = (cur.bytes_recv - _last.bytes_recv) / elapsed

#     # Convert to Mbps (Megabits per second)
#     upload_mbps = round((sent * 8) / (1024 * 1024), 2)
#     download_mbps = round((recv * 8) / (1024 * 1024), 2)

#     # Simulated ping (replace later with actual ICMP if needed)
#     ping_ms = round(psutil.cpu_percent(interval=0.1), 2)

#     _last, _last_t = cur, now

#     # Format timestamp
#     timestamp = time.strftime("%H:%M:%S", time.localtime(now))
#     print(f"{timestamp} s, {upload_mbps} Upload MP, {download_mbps} Download MB")

#     return jsonify({
#         "timestamp": timestamp,
#         "upload": upload_mbps,
#         "download": download_mbps,
#         "ping": ping_ms
#     })

import logging
import psutil
import time
from flask import Blueprint, request, current_app
import threading 

logger = logging.getLogger(__name__)

bandwidth_bp = Blueprint('bandwidth_monitor', __name__)

active_bandwidth_sessions = {}
bandwidth_sessions_lock = threading.Lock() 

def _monitor_loop(sid, app_context, socketio_instance):
    """
    The actual bandwidth monitoring loop that runs in a background thread.
    Emits 'bandwidth_update' events to the specific client using the provided socketio_instance.
    """
    _last_net_io_counters = psutil.net_io_counters()
    _last_timestamp = time.time()

    with app_context:
        logger.info(f"Bandwidth monitor loop started for SID: {sid}")
        session_info = None
        with bandwidth_sessions_lock:
            session_info = active_bandwidth_sessions.get(sid)

        if not session_info:
            logger.warning(f"No session info found for SID {sid} at loop start. Exiting.")
            return

        stop_event = session_info['stop_event']

        while not stop_event.is_set():
            try:
                socketio_instance.sleep(2) 

                now = time.time()
                cur = psutil.net_io_counters()
                elapsed = now - _last_timestamp or 1 

                sent_bps = (cur.bytes_sent - _last_net_io_counters.bytes_sent) / elapsed
                recv_bps = (cur.bytes_recv - _last_net_io_counters.bytes_recv) / elapsed

                upload_mbps = round((sent_bps * 8) / (1024 * 1024), 2)
                download_mbps = round((recv_bps * 8) / (1024 * 1024), 2)

                ping_ms = 0.0
                try:
                    ping_ms = round(psutil.cpu_times_percent(interval=0.1).user, 2)
                except Exception as ping_e:
                    logger.warning(f"SID {sid}: Error calculating 'ping' (CPU usage): {ping_e}")
                    ping_ms = -1

                _last_net_io_counters = cur
                _last_timestamp = now

                timestamp_str = time.strftime("%H:%M:%S", time.localtime(now))

                bandwidth_data = {
                    "timestamp": timestamp_str,
                    "upload": upload_mbps,
                    "download": download_mbps,
                    "ping": ping_ms
                }

                socketio_instance.emit('bandwidth_update', bandwidth_data, room=sid)
                logger.debug(f"SID {sid}: Emitted bandwidth_update: {bandwidth_data}")

            except Exception as e:
                logger.error(f"SID {sid}: Error in bandwidth monitor loop: {e}", exc_info=True)

        logger.info(f"Bandwidth monitor loop stopped for SID: {sid}")
        with bandwidth_sessions_lock:
            if sid in active_bandwidth_sessions:
                del active_bandwidth_sessions[sid]

def clear_bandwidth_session(sid):
    """
    Helper function to stop and clear a bandwidth monitoring session.
    Called on client disconnect or explicit stop request.
    """
    with bandwidth_sessions_lock:
        if sid in active_bandwidth_sessions:
            logger.info(f"Clearing bandwidth session for SID: {sid}")
            active_bandwidth_sessions[sid]['stop_event'].set() 
            del active_bandwidth_sessions[sid]
            return True
    return False

def register_bandwidth_socket_events(socketio_instance):
    """
    Registers Socket.IO event handlers for the bandwidth monitor.
    This function will be called from app.py.
    """
    @socketio_instance.on('start_bandwidth_monitor')
    def handle_start_bandwidth_monitor():
        sid = request.sid
        logger.info(f"Received start_bandwidth_monitor from SID: {sid}")

        with bandwidth_sessions_lock:
            if sid in active_bandwidth_sessions and active_bandwidth_sessions[sid]['thread'].is_alive():
                logger.info(f"Bandwidth monitor already active for SID: {sid}. Not starting new one.")
                socketio_instance.emit('bandwidth_status', {'status': 'info', 'message': 'Bandwidth monitor already running.'}, room=sid)
                return
            clear_bandwidth_session(sid)

            stop_event = threading.Event()
            thread = threading.Thread(target=_monitor_loop, args=(sid, current_app.app_context(), socketio_instance))
            thread.start()

            active_bandwidth_sessions[sid] = {
                'thread': thread,
                'stop_event': stop_event
            }
            socketio_instance.emit('bandwidth_status', {'status': 'success', 'message': 'Bandwidth monitor started.'}, room=sid)
            logger.info(f"Bandwidth monitor started for SID: {sid}")

    @socketio_instance.on('stop_bandwidth_monitor')
    def handle_stop_bandwidth_monitor():
        sid = request.sid
        logger.info(f"Received stop_bandwidth_monitor from SID: {sid}")
        if clear_bandwidth_session(sid):
            socketio_instance.emit('bandwidth_status', {'status': 'info', 'message': 'Bandwidth monitor stopped.'}, room=sid)
        else:
            socketio_instance.emit('bandwidth_status', {'status': 'info', 'message': 'No active bandwidth monitor to stop.'}, room=sid)