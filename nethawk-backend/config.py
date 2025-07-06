import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    FTP_CONNECTIONS = [
        {
            "id": "1",
            "name": os.getenv("FTP1_NAME", "Production Server"),
            "host": os.getenv("FTP1_HOST", "ftp.example.com"),
            "port": int(os.getenv("FTP1_PORT", 21)),
            "username": os.getenv("FTP1_USER", "admin"),
            "protocol": "FTPS"
        },
    ]
    IMAP_HOST = os.getenv("IMAP_HOST", "imap.example.com")