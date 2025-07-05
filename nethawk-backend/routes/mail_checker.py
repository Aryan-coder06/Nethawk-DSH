# from flask import Blueprint, request, jsonify, current_app
# import imaplib

# mail_bp = Blueprint("mail_checker", __name__)

# @mail_bp.route("/check", methods=["POST"])
# def check_mail():
#     data = request.json
#     host = data.get("host", current_app.config["IMAP_HOST"])
#     user, pwd = data["user"], data["pwd"]
#     M = imaplib.IMAP4_SSL(host)
#     M.login(user, pwd)
#     M.select("INBOX")
#     typ, msgs = M.search(None, "UNSEEN")
#     M.logout()
#     return jsonify({"unreadCount": len(msgs[0].split())})


from flask import Blueprint, request, jsonify, current_app
from flask_socketio import emit
import imaplib
import smtplib
from email.message import EmailMessage
from email.parser import BytesParser
import ssl
import uuid
import logging # Import logging for better output

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mail_bp = Blueprint("mail_checker", __name__)

# --- In-memory storage for mail server connection profiles ---
# In a real application, this should be persisted (e.g., database, secure file)
# current_app.config["MAIL_SERVER_CONNECTIONS"] is used as a stand-in for persistence.

# --- HTTP Routes ---

@mail_bp.route("/connections", methods=["GET"])
def get_mail_connections():
    """Returns the list of stored mail server connection profiles."""
    connections = []
    # Do NOT return passwords
    for conn_id, conn_data in current_app.config.get("MAIL_SERVER_CONNECTIONS", {}).items():
        display_data = conn_data.copy()
        display_data.pop("password", None) # Remove password for display
        connections.append(display_data)
    return jsonify(connections)

@mail_bp.route("/add_connection", methods=["POST"])
def add_mail_connection():
    """Adds a new mail server connection profile."""
    data = request.json
    required_fields = ["name", "imap_host", "imap_port", "smtp_host", "smtp_port", "username", "password"]
    if not all(field in data for field in required_fields):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    new_id = str(uuid.uuid4())
    new_connection = {
        "id": new_id,
        "name": data["name"],
        "imap_host": data["imap_host"],
        "imap_port": data["imap_port"],
        "smtp_host": data["smtp_host"],
        "smtp_port": data["smtp_port"],
        "username": data["username"],
        "password": data["password"] # Storing password for simplicity in this demo ONLY
    }
    # Add to the global configuration (simulating persistent storage)
    if "MAIL_SERVER_CONNECTIONS" not in current_app.config:
        current_app.config["MAIL_SERVER_CONNECTIONS"] = {}
    current_app.config["MAIL_SERVER_CONNECTIONS"][new_id] = new_connection
    logger.info(f"Added new mail connection: {new_connection['name']}")
    return jsonify({"success": True, "message": "Connection added", "connection": {k: v for k, v in new_connection.items() if k != 'password'}}) # Don't return password

@mail_bp.route("/delete_connection/<connection_id>", methods=["DELETE"])
def delete_mail_connection(connection_id):
    """Deletes a mail server connection profile."""
    if connection_id in current_app.config.get("MAIL_SERVER_CONNECTIONS", {}):
        deleted_connection_name = current_app.config["MAIL_SERVER_CONNECTIONS"][connection_id].get("name", connection_id)
        del current_app.config["MAIL_SERVER_CONNECTIONS"][connection_id]

        # In a multi-user setup, we would iterate through all active SocketIO sessions
        # and disconnect any that were using this configuration.
        # For this simplified demo, we'll just log and assume the client will handle re-connection.
        logger.info(f"Deleted mail connection profile: {deleted_connection_name}")
        emit('mail_status', {'status': 'info', 'message': f'Connection profile "{deleted_connection_name}" deleted. If active, please reconnect.'}, broadcast=True, namespace='/') # Broadcast for any client that might have been using it

        return jsonify({"success": True, "message": "Connection deleted"})
    logger.warning(f"Attempted to delete non-existent connection: {connection_id}")
    return jsonify({"success": False, "message": "Connection not found"}), 404

# --- Socket.IO Event Handlers ---

# Store active IMAP connections per Socket.IO session ID
# { 'socket_id': {'imap_conn': IMAP4_SSL_object, 'mail_config_id': 'uuid', 'mailbox': 'INBOX'} }
active_mail_sessions = {}

def get_session_connection(sid):
    """Helper to get the IMAP connection for a specific session."""
    return active_mail_sessions.get(sid, {}).get('imap_conn')

def set_session_connection(sid, imap_conn, mail_config_id, mailbox="INBOX"):
    """Helper to set the IMAP connection for a specific session."""
    active_mail_sessions[sid] = {
        'imap_conn': imap_conn,
        'mail_config_id': mail_config_id,
        'mailbox': mailbox
    }

def clear_session_connection(sid):
    """Helper to clear the IMAP connection for a specific session."""
    if sid in active_mail_sessions:
        if active_mail_sessions[sid].get('imap_conn'):
            try:
                active_mail_sessions[sid]['imap_conn'].logout()
                logger.info(f"Logged out IMAP session for SID: {sid}")
            except Exception as e:
                logger.error(f"Error during IMAP logout for SID {sid}: {e}")
        del active_mail_sessions[sid]

def register_mail_socket_events(socketio_instance):

    # @socketio_instance.on("connect")
    # def on_connect():
    #     logger.info(f"Client connected: {request.sid}")

    @socketio_instance.on("disconnect")
    def on_disconnect():
        """Handles client disconnection to clean up IMAP sessions."""
        clear_session_connection(request.sid)
        logger.info(f"Client disconnected and IMAP session cleared: {request.sid}")

    @socketio_instance.on("mail_connect")
    def handle_mail_connect(data):
        """
        Handles an 'mail_connect' event from the frontend.
        Expects { "id": "connection_id", "password": "optional_password_for_login" }
        """
        connection_id = data.get("id")
        # Password for login should ideally be provided by the client each time
        # or securely retrieved from a temporary session store, not from permanent config.
        # For this demo, we fall back to stored if not provided.
        login_password = data.get("password")

        if not connection_id:
            emit("mail_status", {"status": "error", "message": "Connection ID is missing."}, room=request.sid)
            return

        mail_config = current_app.config.get("MAIL_SERVER_CONNECTIONS", {}).get(connection_id)
        if not mail_config:
            emit("mail_status", {"status": "error", "message": "Mail connection profile not found."}, room=request.sid)
            return

        username = mail_config["username"]
        # Use password from data if provided, otherwise fallback to stored (less secure)
        if not login_password:
            login_password = mail_config.get("password")
            if not login_password:
                emit("mail_status", {"status": "error", "message": "Password not provided for login."}, room=request.sid)
                return

        # Disconnect any existing connection for this specific session first
        current_imap_conn = get_session_connection(request.sid)
        if current_imap_conn:
            clear_session_connection(request.sid)

        try:
            logger.info(f"SID {request.sid}: Attempting to connect to IMAP: {mail_config['imap_host']}:{mail_config['imap_port']} as {username}")
            M = imaplib.IMAP4_SSL(mail_config["imap_host"], mail_config["imap_port"])
            M.login(username, login_password)
            M.select("INBOX") # Select INBOX by default

            set_session_connection(request.sid, M, connection_id, mailbox="INBOX")

            emit("mail_status", {
                "status": "connected",
                "message": "Successfully connected to mail server.",
                "current_mail_config_id": connection_id,
                "username": username,
                "host": mail_config["imap_host"]
            }, room=request.sid)
            logger.info(f"SID {request.sid}: Successfully connected to IMAP: {mail_config['imap_host']}")

            # Immediately fetch initial unread count
            typ, msgs = M.search(None, "UNSEEN")
            unread_count = len(msgs[0].split()) if msgs[0] else 0
            typ, msgs_all = M.search(None, "ALL")
            total_messages = len(msgs_all[0].split()) if msgs_all[0] else 0
            emit("mail_inbox_summary", {"unreadCount": unread_count, "totalMessages": total_messages}, room=request.sid)

        except imaplib.IMAP4.error as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: IMAP Connection/Login Error: {error_message}")
            clear_session_connection(request.sid)
            emit("mail_status", {"status": "error", "message": f"IMAP Error: {error_message}"}, room=request.sid)
        except Exception as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: Mail Connection Error: {error_message}")
            clear_session_connection(request.sid)
            emit("mail_status", {"status": "error", "message": f"Connection failed: {error_message}"}, room=request.sid)

    @socketio_instance.on("mail_disconnect")
    def handle_mail_disconnect():
        """Handles an 'mail_disconnect' event from the frontend."""
        current_imap_conn = get_session_connection(request.sid)
        if current_imap_conn:
            clear_session_connection(request.sid)
            emit("mail_status", {"status": "disconnected", "message": "Disconnected from mail server."}, room=request.sid)
        else:
            emit("mail_status", {"status": "disconnected", "message": "No active mail connection to disconnect."}, room=request.sid)

    @socketio_instance.on("mail_list_inbox")
    def handle_mail_list_inbox(data):
        """
        Handles 'mail_list_inbox' event to fetch a list of emails.
        Expects optional 'mailbox' (default 'INBOX'), 'criteria' (e.g., 'ALL', 'UNSEEN'),
        'limit' (number of emails, default 10), and 'offset' (for pagination, default 0).
        """
        imap_conn = get_session_connection(request.sid)
        if not imap_conn:
            emit("mail_status", {"status": "error", "message": "Not connected to a mail server."}, room=request.sid)
            return

        mailbox = data.get("mailbox", "INBOX")
        criteria = data.get("criteria", "ALL")
        limit = int(data.get("limit", 10)) # Default to 10 emails
        offset = int(data.get("offset", 0)) # Default offset 0

        try:
            # Ensure the correct mailbox is selected for this session
            session_info = active_mail_sessions.get(request.sid)
            if session_info and session_info['mailbox'] != mailbox:
                imap_conn.select(mailbox, readonly=True)
                session_info['mailbox'] = mailbox # Update current mailbox in session info
            else:
                imap_conn.select(mailbox, readonly=True) # Ensure readonly for listing

            typ, message_nums = imap_conn.search(None, criteria)
            message_ids = message_nums[0].split()

            # Apply limit and offset for pagination
            # IMAP UIDs are not necessarily sequential, so slicing message_ids is crucial
            # We want the newest emails, so slice from the end, then reverse for display
            start_index = max(0, len(message_ids) - (offset + limit))
            end_index = max(0, len(message_ids) - offset)
            
            # Ensure we don't go out of bounds and always get a valid slice
            # This logic ensures we fetch the *latest* 'limit' messages, adjusted by 'offset'
            selected_message_ids = message_ids[start_index:end_index]
            
            emails_list = []
            # Fetch in reverse order to get newest first for display
            for num in reversed(selected_message_ids):
                # Using UID FETCH is generally more robust for persistence and concurrent access
                # UID FETCH (UID) BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)]
                typ, msg_data = imap_conn.uid("FETCH", num, '(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)])')
                
                if typ == 'OK' and msg_data[0]:
                    raw_headers = msg_data[0][1] # msg_data[0] is (FLAGS, raw_email_data)
                    
                    # Parse headers using EmailMessage
                    # EmailMessage can parse directly from bytes
                    try:
                        # Create an EmailMessage object and parse headers
                        msg = BytesParser().parsebytes(raw_headers)
                        
                        email_item = {
                            "uid": num.decode('utf-8'), # IMAP UID
                            "subject": msg.get("Subject", "No Subject").strip(),
                            "from": msg.get("From", "Unknown Sender").strip(),
                            "date": msg.get("Date", "Unknown Date").strip(),
                            "message_id": msg.get("Message-ID", "").strip() # Add Message-ID for better identification
                        }
                        emails_list.append(email_item)
                    except Exception as parse_e:
                        logger.warning(f"SID {request.sid}: Error parsing email headers for UID {num}: {parse_e}")
                        # Optionally add a placeholder or skip this email
                        emails_list.append({"uid": num.decode('utf-8'), "subject": "Parse Error", "from": "N/A", "date": "N/A"})
                else:
                    logger.warning(f"SID {request.sid}: Failed to fetch headers for UID {num}. Status: {typ}, Data: {msg_data}")


            emit("mail_inbox_listing", {"mailbox": mailbox, "emails": emails_list, "totalCount": len(message_ids)}, room=request.sid)
            logger.info(f"SID {request.sid}: Fetched {len(emails_list)} emails from {mailbox} with criteria '{criteria}' (Total: {len(message_ids)})")

            # Also update the unread/total count after a listing
            typ, msgs_all = imap_conn.search(None, "ALL")
            total_messages = len(msgs_all[0].split()) if msgs_all[0] else 0
            typ, msgs_unseen = imap_conn.search(None, "UNSEEN")
            unread_count = len(msgs_unseen[0].split()) if msgs_unseen[0] else 0
            emit("mail_inbox_summary", {"unreadCount": unread_count, "totalMessages": total_messages}, room=request.sid)

        except imaplib.IMAP4.error as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: IMAP List Error: {error_message}")
            emit("mail_status", {"status": "error", "message": f"IMAP List Error: {error_message}"}, room=request.sid)
        except Exception as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: Error listing emails: {error_message}")
            emit("mail_status", {"status": "error", "message": f"Error listing emails: {error_message}"}, room=request.sid)

    @socketio_instance.on("mail_get_email_content")
    def handle_mail_get_email_content(data):
        """
        Handles 'mail_get_email_content' event to fetch the full content of a specific email.
        Expects { "uid": "email_uid", "mailbox": "INBOX" }
        """
        imap_conn = get_session_connection(request.sid)
        if not imap_conn:
            emit("mail_status", {"status": "error", "message": "Not connected to a mail server."}, room=request.sid)
            return

        uid = data.get("uid")
        mailbox = data.get("mailbox", "INBOX")

        if not uid:
            emit("mail_status", {"status": "error", "message": "Email UID is required."}, room=request.sid)
            return

        try:
            # Ensure the correct mailbox is selected for this session
            session_info = active_mail_sessions.get(request.sid)
            if session_info and session_info['mailbox'] != mailbox:
                imap_conn.select(mailbox, readonly=True)
                session_info['mailbox'] = mailbox # Update current mailbox in session info
            else:
                imap_conn.select(mailbox, readonly=True) # Ensure readonly for fetching

            # Ensure UID is bytes
            uid_bytes = uid.encode('utf-8')
            typ, msg_data = imap_conn.uid("FETCH", uid_bytes, "(RFC822)") # Fetch by UID

            if typ == 'OK' and msg_data and msg_data[0]:
                raw_email = msg_data[0][1]
                # Parse the raw email content
                msg = BytesParser().parsebytes(raw_email)

                # Extract parts for display
                body_content = ""
                html_content = ""
                attachments = []

                # Iterate over parts to find text/plain or text/html and attachments
                for part in msg.walk():
                    ctype = part.get_content_type()
                    cdisp = part.get('Content-Disposition')
                    filename = part.get_filename()

                    if cdisp and cdisp.startswith('attachment') and filename:
                        attachments.append({
                            "filename": filename,
                            "content_type": ctype,
                            "size": len(part.get_payload(decode=True)) # Size in bytes
                            # In a real app, you might provide a download link or base64 encode smaller attachments
                        })
                    elif ctype == 'text/plain' and not filename: # Exclude plain text parts that are attachments
                        body_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        # For now, prefer plain text as the main 'body' if present, but also capture HTML
                    elif ctype == 'text/html' and not filename: # Exclude HTML parts that are attachments
                        html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')

                # Prioritize HTML for display if available, otherwise use plain text
                display_content = html_content if html_content else body_content

                email_details = {
                    "uid": uid,
                    "subject": msg.get("Subject", "No Subject").strip(),
                    "from": msg.get("From", "Unknown Sender").strip(),
                    "to": msg.get("To", "Unknown Recipient").strip(),
                    "cc": msg.get("Cc", "").strip(),
                    "bcc": msg.get("Bcc", "").strip(),
                    "date": msg.get("Date", "Unknown Date").strip(),
                    "message_id": msg.get("Message-ID", "").strip(),
                    "body": display_content, # The content to primarily display
                    "plain_text_body": body_content, # Always send plain text
                    "html_body": html_content, # Always send HTML
                    "attachments": attachments
                }
                emit("mail_email_content", email_details, room=request.sid)
                logger.info(f"SID {request.sid}: Fetched full content for email UID {uid}")
            else:
                logger.warning(f"SID {request.sid}: Email content not found or error fetching for UID {uid}. Status: {typ}, Data: {msg_data}")
                emit("mail_status", {"status": "error", "message": "Email content not found or error fetching."}, room=request.sid)

        except imaplib.IMAP4.error as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: IMAP Fetch Content Error for UID {uid}: {error_message}")
            emit("mail_status", {"status": "error", "message": f"IMAP Fetch Error: {error_message}"}, room=request.sid)
        except Exception as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: Error fetching email content for UID {uid}: {error_message}")
            emit("mail_status", {"status": "error", "message": f"Error fetching content: {error_message}"}, room=request.sid)


    @socketio_instance.on("mail_send_test")
    def handle_mail_send_test(data):
        """
        Handles 'mail_send_test' event to send a test email.
        Expects { "connection_id": "...", "recipient_email": "...", "subject": "...", "body": "...", "password": "optional_password_for_smtp_if_not_stored" }
        """
        connection_id = data.get("connection_id")
        if not connection_id:
            # Fallback to currently active IMAP config if not explicitly provided
            session_info = active_mail_sessions.get(request.sid)
            if session_info:
                connection_id = session_info.get('mail_config_id')

        if not connection_id:
            emit("mail_status", {"status": "error", "message": "No mail configuration selected or active to send from."}, room=request.sid)
            return

        mail_config = current_app.config.get("MAIL_SERVER_CONNECTIONS", {}).get(connection_id)
        if not mail_config:
            emit("mail_status", {"status": "error", "message": "Mail configuration profile not found."}, room=request.sid)
            return

        sender_email = mail_config["username"]
        recipient_email = data.get("recipient_email")
        subject = data.get("subject", "Test Email from NetHawk Mail Checker")
        body = data.get("body", "This is a test email sent from your NetHawk Mail Checker application.")
        
        # Use password from data if provided (more secure), otherwise fallback to stored
        smtp_password = data.get("password")
        if not smtp_password:
            smtp_password = mail_config.get("password")
            if not smtp_password:
                emit("mail_status", {"status": "error", "message": "Password not provided for SMTP sending."}, room=request.sid)
                return

        if not recipient_email:
            emit("mail_status", {"status": "error", "message": "Recipient email is required for sending."}, room=request.sid)
            return

        try:
            msg = EmailMessage()
            msg.set_content(body)
            msg["Subject"] = subject
            msg["From"] = sender_email
            msg["To"] = recipient_email

            logger.info(f"SID {request.sid}: Attempting to send email via SMTP: {mail_config['smtp_host']}:{mail_config['smtp_port']} from {sender_email} to {recipient_email}")

            context = ssl.create_default_context()
            with smtplib.SMTP(mail_config["smtp_host"], mail_config["smtp_port"]) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(sender_email, smtp_password)
                server.send_message(msg)

            emit("mail_status", {"status": "success", "message": f"Test email sent to {recipient_email}."}, room=request.sid)
            logger.info(f"SID {request.sid}: Test email successfully sent to {recipient_email}")

        except smtplib.SMTPAuthenticationError:
            logger.error(f"SID {request.sid}: SMTP Authentication Error for {sender_email}.")
            emit("mail_status", {"status": "error", "message": "SMTP Authentication failed. Check username/password for sending."}, room=request.sid)
        except smtplib.SMTPConnectError as e:
            logger.error(f"SID {request.sid}: SMTP Connection Error: {e}")
            emit("mail_status", {"status": "error", "message": f"SMTP connection error: {e}"}, room=request.sid)
        except Exception as e:
            error_message = str(e)
            logger.error(f"SID {request.sid}: Error sending test email: {error_message}")
            emit("mail_status", {"status": "error", "message": f"Error sending email: {error_message}"}, room=request.sid)