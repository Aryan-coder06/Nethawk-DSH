import logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__) 

from dotenv import load_dotenv
load_dotenv()

import os

import eventlet
eventlet.monkey_patch()

from ftplib import FTP, error_perm, error_temp
from io import BytesIO
import base64
from utils import parse_ftp_list
from flask import Flask, request, current_app 
from flask_cors import CORS
from flask_socketio import SocketIO, emit 
from config import Config
import time
import psutil
from threading import Thread, Event, Lock 
import datetime

from routes.port_scanner import run_port_scan, ip_add_pattern, parse_ports_string

from routes.ftp import ftp_bp
from routes.mail_checker import mail_bp, register_mail_socket_events

frontend_origin = os.getenv("FRONTEND_URL", "http://localhost:5173")
socketio = SocketIO(cors_allowed_origins=[frontend_origin])

bandwidth_thread = None
bandwidth_stop_event = Event() 

ftp_clients = {}
ftp_clients_lock = Lock()

scan_thread = None
scan_stop_event = Event() 

mail_checker_clients = {} 
mail_checker_clients_lock = Lock() 

def bandwidth_monitor_task():
    """
    A background task that continuously emits bandwidth usage.
    Runs in an Eventlet-patched Thread.
    """
    _last, _last_t = psutil.net_io_counters(), time.time()

    with app.app_context():
        logger.info("Bandwidth monitor task started inside app context.")
        while not bandwidth_stop_event.is_set():
            try:
                socketio.sleep(2) 

                now = time.time()
                cur = psutil.net_io_counters()
                elapsed = now - _last_t or 1

                sent_bps = (cur.bytes_sent - _last.bytes_sent) / elapsed
                recv_bps = (cur.bytes_recv - _last.bytes_recv) / elapsed

                upload_mbps = round((sent_bps * 8) / (1024 * 1024), 2)
                download_mbps = round((recv_bps * 8) / (1024 * 1024), 2)

                ping_ms = 0.0 
                try:
                    ping_ms = round(psutil.cpu_times_percent(interval=0.1).user, 2)
                except Exception as ping_e:
                    logger.warning(f"Error calculating 'ping' (CPU usage): {ping_e}")
                    ping_ms = -1 

                _last, _last_t = cur, now

                timestamp = time.strftime("%H:%M:%S", time.localtime(now))

                bandwidth_data = {
                    "timestamp": timestamp,
                    "upload": upload_mbps,
                    "download": download_mbps,
                    "ping": ping_ms
                }

                socketio.emit('bandwidth_update', bandwidth_data)

            except Exception as e:
                logger.error(f"Error in bandwidth_monitor_task: {e}", exc_info=True) 
                socketio.sleep(1) 
        logger.info("Bandwidth monitor task stopped.") 

@socketio.on('connect')
def handle_connect():
    global bandwidth_thread
    logger.info(f'--- DEBUG: handle_connect called for SID: {request.sid} ---')

    try:
        if bandwidth_thread is None or not bandwidth_thread.is_alive():
            bandwidth_stop_event.clear()
            bandwidth_thread = Thread(target=bandwidth_monitor_task)
            bandwidth_thread.start()
        else:
            logger.info("--- DEBUG: Bandwidth task already running for this server instance. ---")
    except Exception as e:
        logger.critical(f"--- CRITICAL ERROR: Failed to start bandwidth thread in handle_connect: {e}", exc_info=True)

    emit('my_response', {'data': f'Connected to backend! Your SID: {request.sid}'}, room=request.sid)
    logger.info(f'--- DEBUG: handle_connect finished for SID: {request.sid} ---')

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Client {request.sid} disconnected')
    sid = request.sid
    with ftp_clients_lock:
        if sid in ftp_clients and ftp_clients[sid].get('ftp_instance'):
            try:
                ftp_clients[sid]['ftp_instance'].quit()
                logger.info(f"FTP client for SID {sid} quit on Socket.IO disconnect.")
            except Exception as e:
                logger.error(f"Error quitting FTP client on Socket.IO disconnect for SID {sid}: {e}")
            finally:
                if sid in ftp_clients: 
                    del ftp_clients[sid]
    with mail_checker_clients_lock:
        if sid in mail_checker_clients and mail_checker_clients[sid].get('imap_instance'):
            try:
                mail_checker_clients[sid]['imap_instance'].logout()
                logger.info(f"IMAP client for SID {sid} logged out on Socket.IO disconnect.")
            except Exception as e:
                logger.error(f"Error logging out IMAP client on Socket.IO disconnect for SID {sid}: {e}")
            finally:
                if sid in mail_checker_clients: 
                    del mail_checker_clients[sid]
    logger.info(f"Client disconnected: {sid}")

def port_scan_task_wrapper(host, ports_str, sid):
    """
    Wrapper for run_port_scan to integrate with SocketIO and stop event.
    Runs in an Eventlet-patched Thread.
    """
    global scan_stop_event

    with app.app_context():
        try:
            logger.info(f"Port scan task started for {host}:{ports_str} (SID: {sid})") 
            for update in run_port_scan(host, ports_str, scan_stop_event):
                if scan_stop_event.is_set() and update['status'] not in ['complete', 'error', 'stopped']:
                    logger.info(f"Scan for {host} (SID: {sid}) signaled to stop by event. Exiting wrapper loop.") 
                    break

                socketio.emit('scan_update', update, room=sid)
                socketio.sleep(0.01)

        except Exception as e:
            logger.error(f"Error in port scan task for SID {sid}: {e}", exc_info=True) 
            socketio.emit('scan_update', {'status': 'error', 'message': f"An internal server error occurred during scan: {str(e)}"}, room=sid)
        finally:
            logger.info(f"Port scan task for SID {sid} finished/stopped. Clearing stop event.") 
            scan_stop_event.clear()
            global scan_thread
            scan_thread = None

@socketio.on('start_port_scan')
def handle_start_port_scan(data):
    global scan_thread
    global scan_stop_event

    host = data.get('host')
    ports_str = data.get('ports')

    if not host or not ports_str:
        emit('scan_update', {'status': 'error', 'message': 'Host and ports are required.'}, room=request.sid)
        return

    if not ip_add_pattern.search(host):
        emit('scan_update', {'status': 'error', 'message': 'Invalid IP address format.'}, room=request.sid)
        return

    if scan_thread and scan_thread.is_alive():
        logger.info(f"Existing scan (for SID: {request.sid}) is running. Signalling it to stop before starting a new one.") 
        scan_stop_event.set()
        socketio.sleep(1)

        if scan_thread.is_alive():
            logger.warning(f"Previous scan thread did not terminate in time. Proceeding, but may cause issues.") 

        scan_stop_event.clear()
        logger.info("Previous scan stop event cleared, proceeding with new scan.") 
    else:
        scan_stop_event.clear()

    logger.info(f"Received new scan request from SID {request.sid} for {host} on ports: {ports_str}") 

    scan_thread = Thread(target=port_scan_task_wrapper, args=(host, ports_str, request.sid))
    scan_thread.start()
    emit('scan_update', {'status': 'info', 'message': f'Scan initiated for {host} on ports: {ports_str}. Updates will follow.'}, room=request.sid)

@socketio.on('stop_port_scan')
def handle_stop_port_scan():
    global scan_thread
    global scan_stop_event

    if scan_thread and scan_thread.is_alive():
        logger.info(f"Stop request received from SID {request.sid}. Signalling scan to stop.") 
        scan_stop_event.set()
        emit('scan_update', {'status': 'info', 'message': 'Scan stop request received. Waiting for termination...'}, room=request.sid)
    else:
        emit('scan_update', {'status': 'info', 'message': 'No active scan to stop.'}, room=request.sid)

@socketio.on('ftp_connect')
def handle_ftp_connect(data):
    """Handles FTP connection requests from a client."""
    sid = request.sid
    conn_id = data.get('id')
    password = data.get('password', '')

    with current_app.app_context():
        conn_profile = next((c for c in current_app.config["FTP_CONNECTIONS"] if c["id"] == conn_id), None)

    if not conn_profile:
        emit('ftp_status', {
            'status': 'error',
            'message': 'Connection profile not found.',
            'is_connected': False
        }, room=sid)
        return

    with ftp_clients_lock:
        if sid in ftp_clients and ftp_clients[sid].get('ftp_instance'):
            if ftp_clients[sid]['host'] == conn_profile["host"]:
                emit('ftp_status', {
                    'status': 'info',
                    'message': 'Already connected to this FTP server in this session.',
                    'is_connected': True,
                    'current_host': ftp_clients[sid]['host']
                }, room=sid)
                return
            else:
                try:
                    ftp_clients[sid]['ftp_instance'].quit()
                    del ftp_clients[sid]
                    emit('ftp_status', {
                        'status': 'info',
                        'message': 'Disconnected from previous FTP server.',
                    }, room=sid)
                except Exception as e:
                    logger.warning(f"Warning: Error quitting old FTP instance for SID {sid}: {e}") 
                    del ftp_clients[sid]

    try:
        current_ftp = FTP(timeout=10)
        logger.info(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Attempting to connect to {conn_profile['host']}:{conn_profile['port']}") 
        current_ftp.connect(conn_profile["host"], conn_profile["port"])
        logger.info(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Connected to {conn_profile['host']}. Logging in as {conn_profile['username']}") 
        current_ftp.login(conn_profile["username"], password)
        logger.info(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Logged in to {conn_profile['host']}.") 

        with ftp_clients_lock:
            ftp_clients[sid] = {
                'ftp_instance': current_ftp,
                'host': conn_profile["host"],
                'current_path': '/'
            }

        emit('ftp_status', {
            'status': 'success',
            'message': f'Successfully connected to {conn_profile["host"]}.',
            'is_connected': True,
            'current_host': conn_profile["host"]
        }, room=sid)

    except error_perm as e:
        msg = f"FTP Login Error: {e}"
        logger.error(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Error connecting FTP: {msg}") 
        emit('ftp_status', {
            'status': 'error',
            'message': msg,
            'is_connected': False
        }, room=sid)
    except error_temp as e:
        msg = f"FTP Temporary Error: {e}"
        logger.error(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Error connecting FTP: {msg}") 
        emit('ftp_status', {
            'status': 'error',
            'message': msg,
            'is_connected': False
        }, room=sid)
    except Exception as e:
        msg = f"FTP Connection Error: {e}"
        logger.error(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Error connecting FTP: {msg}") 
        emit('ftp_status', {
            'status': 'error',
            'message': msg,
            'is_connected': False
        }, room=sid)

@socketio.on('ftp_disconnect')
def handle_ftp_disconnect_event():
    """Handles explicit FTP disconnection requests from a client."""
    sid = request.sid
    with ftp_clients_lock:
        if sid in ftp_clients and ftp_clients[sid].get('ftp_instance'):
            try:
                ftp_clients[sid]['ftp_instance'].quit()
                logger.info(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: FTP client quit successfully.") 
                del ftp_clients[sid]
                emit('ftp_status', {
                    'status': 'info',
                    'message': 'Disconnected from FTP server.',
                    'is_connected': False
                }, room=sid)
            except Exception as e:
                logger.error(f"[{datetime.now().strftime('%H:%M:%S')}] SID {sid}: Error during explicit FTP disconnect: {e}") 
                del ftp_clients[sid]
                emit('ftp_status', {
                    'status': 'error',
                    'message': f'Error during disconnection: {e}. Connection cleared.',
                    'is_connected': False
                }, room=sid)
        else:
            emit('ftp_status', {
                'status': 'info',
                'message': 'No active FTP connection to disconnect.',
                'is_connected': False
            }, room=sid)

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    app.config["FTP_CONNECTIONS"] = [
        {
            "id": "1",
            "name": "My Local FTP Test",
            "host": "localhost",
            "port": 21,
            "username": "testuser",
            "protocol": "FTP"
        },
        {
            "id": "2",
            "name": "Another Server (Example)",
            "host": "ftp.example.com",
            "port": 21,
            "username": "guest",
            "protocol": "FTP"
        },
    ]

    app.config["MAIL_SERVER_CONNECTIONS"] = {
        "gmail_example": {
            "id": "gmail_example",
            "name": "Gmail (IMAP & SMTP)",
            "imap_host": "imap.gmail.com",
            "imap_port": 993,
            "smtp_host": "smtp.gmail.com",
            "smtp_port": 587,
            "username": "your_gmail_email@gmail.com",
            "password": "your_gmail_app_password"
        },
        "outlook_example": {
            "id": "outlook_example",
            "name": "Outlook (IMAP & SMTP)",
            "imap_host": "outlook.office365.com",
            "imap_port": 993,
            "smtp_host": "smtp.office365.com",
            "smtp_port": 587,
            "username": "your_outlook_email@outlook.com",
            "password": "your_outlook_password"
        }
    }

    frontend_origin = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS(app, resources={r"/*": {"origins": [frontend_origin]}})

    socketio.init_app(app)

    try:
        from routes.overview import ov_bp
        from routes.ftp import ftp_bp
        from routes.mail_checker import mail_bp, register_mail_socket_events

        app.register_blueprint(ov_bp, url_prefix="/api/overview")
        app.register_blueprint(ftp_bp, url_prefix="/ftp")
        app.register_blueprint(mail_bp, url_prefix="/api/mail")
        logger.info("Blueprints registered successfully.")

        register_mail_socket_events(socketio)

    except ImportError as e:
        logger.error(f"Warning: Could not import one or more blueprints: {e}. API routes might not be available.")

    return app

app = create_app()

