# --- Dockerfile for Nethawk Backend ---

# Use official lightweight Python image
FROM python:3.11-slim

# Install OS packages (nmap included)
RUN apt-get update && apt-get install -y nmap && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy backend code into container
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port used by the app
EXPOSE 5000

# Start Flask app with Gunicorn + eventlet
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "app:app"]
