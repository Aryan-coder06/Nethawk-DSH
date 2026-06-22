# NetHawk

NetHawk is a **terminal-first local network diagnostics suite**. It monitors the machine it is running on, explains likely network/system issues through a rule-based Network Doctor, runs local port scans, and stores audit history for review.

The original project started as a React + Flask network dashboard. During development, the product direction was corrected: a deployed web backend mostly monitors the deployed server/container, not the user's actual laptop or local network. NetHawk is now local-first, with the Textual TUI as the primary interface and the React dashboard kept as an optional localhost visual dashboard.

## What It Does

- Shows real local CPU, memory, disk, upload/download, uptime, and TCP latency metrics.
- Refreshes the TUI dashboard every 1.25 seconds.
- Measures latency with a permission-safe TCP connection instead of raw ICMP ping.
- Runs local Nmap scans from the TUI without requiring the Flask server.
- Labels common exposed ports such as SSH, Telnet, Redis, MongoDB, MySQL, PostgreSQL, and RDP.
- Generates deterministic Network Doctor cards with evidence and suggested actions.
- Persists settings and activity history in local JSON storage.
- Keeps the existing React + Flask dashboard available for localhost visualization.

## Why Local-First

A network diagnostics tool should inspect the user's own machine and network path. If the backend is deployed to a cloud host, it can only observe that cloud host's CPU, interfaces, latency, and ports. That is useful for server monitoring, but not for answering questions like:

- Is my laptop under CPU or memory pressure?
- Is my current network upload causing latency?
- Which local services are exposed on my machine?
- What changed recently in my local diagnostics history?

For those workflows, the tool must run locally. NetHawk's TUI directly imports the reusable Python core modules and does not need the Flask server to be running.

## Features

### Terminal UI

The Textual + Rich TUI has 7 screens:

- Dashboard
- Doctor
- Port Scan
- Bandwidth
- History
- Settings
- Help

Keyboard shortcuts:

| Key | Action |
| --- | --- |
| `q` | Quit |
| `r` | Refresh |
| `d` | Dashboard |
| `o` | Doctor |
| `s` | Port Scan |
| `b` | Bandwidth |
| `h` | History |
| `g` | Settings |
| `?` | Help |
| `Up/Down` | Move through sidebar navigation |

### Network Doctor

The Network Doctor is rule-based, not ML. It turns metrics, latency, activity history, and latest scan data into cards containing:

- severity
- title
- possible cause
- evidence
- suggested actions

Implemented rules include:

- healthy system state
- high latency with heavy upload
- high latency without local CPU/network load
- high CPU with heavy network activity
- high CPU with low network usage
- high memory pressure
- SSH exposure on port 22
- RDP exposure on port 3389
- many open ports
- frequent recent warning/error events
- latency target unavailable

### Port Scanning

The TUI runs local Nmap scans and displays:

- port
- protocol
- state
- service
- risk label

Common risk labels are included for ports such as `21`, `22`, `23`, `25`, `53`, `80`, `110`, `143`, `443`, `3306`, `5432`, `6379`, `27017`, and `3389`.

### Persistence

NetHawk stores settings and activity history locally under:

```text
nethawk-backend/.nethawk/store.json
```

Redis support remains available if configured, but local JSON works by default.

## Tech Stack

Core/local tooling:

- Python
- psutil
- Textual
- Rich
- Nmap
- local JSON persistence

Optional localhost web dashboard:

- Flask
- Flask-SocketIO
- React
- TypeScript
- TailwindCSS
- Recharts

## Architecture

```text
NetHawk
|
|-- nethawk-backend/
|   |-- core/
|   |   |-- latency.py            # TCP latency helper
|   |   |-- diagnosis_engine.py   # rule-based Network Doctor
|   |   |-- port_scan.py          # local Nmap scan helper
|   |
|   |-- nethawk_tui/
|   |   |-- app.py                # Textual app shell
|   |   |-- screens.py            # Rich renderers
|   |   |-- widgets.py            # local data adapters
|   |   |-- theme.tcss            # TUI theme/layout
|   |
|   |-- routes/                   # optional Flask API routes
|   |-- metrics_store.py          # local JSON/Redis-backed store
|   |-- app.py                    # optional Flask + Socket.IO backend
|
|-- frontend/
|   |-- React + TypeScript dashboard for localhost visualization
```

The TUI path avoids importing Flask app startup, Socket.IO, or Eventlet. It uses reusable local modules directly.

## Run The TUI

```bash
cd nethawk-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m nethawk_tui
```

Nmap is required for full port scanning:

```bash
nmap --version
```

If Nmap is missing, the TUI shows a clean scan error instead of crashing.

## Demo Workflow

```bash
cd nethawk-backend
source .venv/bin/activate
python -m nethawk_tui
```

Suggested demo flow:

1. Open Dashboard with `d` and show live CPU/memory/network/latency.
2. Open Doctor with `o` and explain rule-based diagnosis cards.
3. Open Port Scan with `s`, scan `127.0.0.1` on `22,80,443`, and explain risk labels.
4. Open Bandwidth with `b` and show current/peak upload and download.
5. Open Settings with `g`, update latency target or thresholds, then save.
6. Open History with `h` and show persisted scan/settings events.

## Optional Localhost Web Dashboard

The existing web dashboard is still available as an optional visual interface.

Backend:

```bash
cd nethawk-backend
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Use this as a localhost dashboard. It should not be presented as a cloud-hosted tool for monitoring visitors' machines.

## Verification

From `nethawk-backend`:

```bash
source .venv/bin/activate
python -m compileall core nethawk_tui routes scripts app.py metrics_store.py
python scripts/verify_foundation.py
python scripts/verify_diagnosis.py
python scripts/verify_tui_phase3b.py
```

## Known Limitations

- Nmap must be installed locally for full port scanning.
- TCP latency is not ICMP ping. It is used because it is permission-safe and works without raw socket privileges.
- The TUI monitors the local machine where it runs, not remote users.
- The web dashboard is intended for localhost visualization, not cloud monitoring of users' machines.
- The Network Doctor is deterministic and rule-based, not ML.
- Scan progress is currently status-based, not per-port streaming progress.
- FTP/mail modules from the earlier dashboard still exist, but they are not the focus of the local-first TUI.

## Interview Explanation

### Problem

Most small network utility projects either show raw terminal output or build a web dashboard that looks good but does not truly monitor the user's local machine once deployed.

### Why Web-Only Was Not Enough

The first version was a React + Flask dashboard. That was visually useful, but a deployed backend only observes the server it runs on. For local diagnostics, the tool needs direct access to local system counters, local network interfaces, and local Nmap scans.

### Local-First Redesign

NetHawk was redesigned around a terminal-first TUI. The TUI runs locally, imports reusable Python core modules directly, and keeps the web dashboard as an optional localhost view.

### How It Works

`psutil` collects system and bandwidth metrics. A TCP latency helper measures network responsiveness without raw ICMP privileges. Nmap performs local port scans. The Network Doctor applies readable rules to metrics, latency, activity history, and scan results. Settings and audit history are persisted locally.

### Trade-Offs

TCP latency is safer than ICMP but not identical to ping. Nmap gives useful scan detail but must be installed. A rule-based doctor is explainable and deterministic, but it is not adaptive like ML.

### Future Improvements

- Streaming scan progress in the TUI.
- Export scan results to JSON/CSV.
- Better process-level network attribution.
- Packaged CLI commands such as `nethawk tui`, `nethawk scan`, and `nethawk doctor`.
- More configurable diagnosis thresholds.

## Resume Bullets

- Built NetHawk, a terminal-first local diagnostics suite using Python, Textual, Rich, psutil, Nmap, and a Flask/Socket.IO optional backend, with 1.25s TUI auto-refresh, 7 diagnostic screens, TCP latency checks, local port scanning, and persistent JSON-backed audit history.
- Redesigned the project from a deployed web dashboard into a local-first network utility, adding a rule-based Network Doctor with 8+ explainable rules and 10+ common port risk labels to turn raw telemetry into actionable troubleshooting guidance.
