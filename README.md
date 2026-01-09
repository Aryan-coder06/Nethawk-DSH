# Nethawk-DSH 🌐🦅

A real-time Network Utility Dashboard built to make everyday network visibility **simple, visual, and useful**. Nethawk-DSH brings multiple utilities (bandwidth, port scanning, FTP, mail checks, notifications, settings) into one clean, modern interface so anyone can monitor and understand their local network activity without digging through terminal logs.

---

## 📌 Index
- [Why Nethawk-DSH?](#-why-nethawk-dsh)
- [What Problem It Solves](#-what-problem-it-solves)
- [Key Highlights](#-key-highlights)
- [Real-Time Features](#-real-time-features)
- [Core Tools Explained](#-core-tools-explained)
- [Architecture Overview](#-architecture-overview)
- [Tech Stack](#-tech-stack)
- [My Customization & Speciality](#-my-customization--speciality)
- [How It Stands Out](#-how-it-stands-out)
- [Local Setup](#-local-setup)
- [Usage Tips](#-usage-tips)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Why Nethawk-DSH?
Most network utilities are built for advanced users or live as separate tools. Nethawk-DSH **unifies** them into a single dashboard so beginners and professionals can **see what’s happening instantly**. It is designed for clarity, focus, and real-time understanding.

---

## 🧩 What Problem It Solves
- **Fragmentation:** You normally need multiple tools for bandwidth, ports, FTP, and email checks.
- **Low visibility:** Raw output is hard to interpret without graphs or context.
- **Lack of realtime UI:** Traditional tools refresh slowly or require manual execution.

Nethawk-DSH solves this by providing **live charts, notifications, and guided explanations** directly in the UI.

---

## ✨ Key Highlights
- **Live monitoring** of bandwidth with history and interface breakdown.
- **Port scanning** using Nmap with optimized parameters and cleaner results.
- **FTP Manager** integration for quick local transfer visibility.
- **Mail Checker** for latency + server response inspection.
- **Settings sync** with backend storage and toast feedback.
- **Realtime notifications** in the header using backend updates.

---

## ⚡ Real-Time Features
- **Bandwidth tracking:** 24-hour history + device/interface usage.
- **Notifications bell:** Auto-refreshes every 15s from the backend.
- **Settings persistence:** Saves server-side so UI stays consistent.
- **Socket-based updates:** Live updates reduce manual refreshes.

---

## 🧰 Core Tools Explained

### 📊 Overview
A central view of network activity with live graphs, breakdowns, and quick insights. Gives a fast pulse-check for your system/network health.

### 📈 Bandwidth Monitor
Tracks upload/download in realtime, keeps history for 24h, and splits usage by interface (Wi-Fi, Ethernet, Loopback). Ideal for spotting spikes or unnecessary traffic.

### 🔍 Port Scanner
Uses optimized Nmap options to scan common or custom ports. The results are simplified so anyone can read:
- **Open:** reachable
- **Closed:** actively refused
- **Filtered:** blocked by firewall

### 📁 FTP Manager
Allows basic FTP interactions and directory listing. Useful for local transfer monitoring and validating FTP availability.

### ✉️ Mail Checker
Checks responsiveness and gives visibility into mail server status and delays.

### ⚙️ Settings
Controls scan timeouts, retries, and notifications. Changes persist via backend so the system behaves consistently.

---

## 🧠 Architecture Overview
- **Frontend:** React + modern UI layout, chart components, and guided tool explanations.
- **Backend:** Flask + SocketIO for realtime updates and APIs.
- **Data Flow:** Metrics are generated in backend loops → stored locally/Redis → served to frontend via API + sockets.

---

## 🛠 Tech Stack
**Frontend:**
- React + TypeScript
- TailwindCSS + custom UI components
- Recharts for graphs
- Sonner for toasts

**Backend:**
- Flask + Flask-SocketIO
- Nmap (port scanning)
- psutil (bandwidth tracking)
- Redis (optional, for metrics persistence)

---

## 🌟 My Customization & Speciality
- **Guided UI Sections:** Each page includes a readable “How it works” section so even beginners understand the feature.
- **Real-time workflows:** Most actions update instantly instead of waiting for a page reload.
- **Clean visuals:** Teal/blue accent theme for a professional yet modern look.
- **Scalable design:** Structured so new utilities can be added quickly.

---

## 🚀 How It Stands Out
- **Not just a demo:** Built to look and feel production-ready.
- **Multi-tool in one place:** Less friction compared to using separate apps.
- **User education built-in:** The UI explains *why* and *how* results are calculated.
- **Designed for growth:** Roadmap-ready for cloud deployment and global use.

---

## 🧪 Local Setup

### Backend
```bash
cd nethawk-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ✅ Usage Tips
- Run backend first so the frontend receives realtime data.
- Use the **Settings** page to tune scanner timeouts or retries.
- Watch the bell icon for realtime updates and activity hints.

---

## 🧭 Roadmap
- ✅ Real-time bandwidth history + interface usage
- ✅ Live notification system
- ✅ Settings persistence
- 🔜 More advanced FTP operations
- 🔜 External deployment with public dashboards
- 🔜 Authentication (optional)
- 🔜 Advanced analytics with custom alerts

---

## 📜 License
MIT (or update as needed).

---

Built with focus, clarity, and real-world learning. ✨
