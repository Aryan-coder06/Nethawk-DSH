from app import create_app, socketio

app = create_app()

import logging
logging.basicConfig(level=logging.DEBUG)
logging.debug("WSGI: Flask app created successfully.")
