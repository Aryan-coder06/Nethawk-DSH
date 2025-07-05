from app import create_app, socketio

app = create_app()

if __name__ != "__main__":
    # Render will start Gunicorn via CMD
    # This is all you need
    pass
