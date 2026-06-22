from rich import box
from rich.align import Align
from rich.columns import Columns
from rich.console import Group
from rich.panel import Panel
from rich.progress_bar import ProgressBar
from rich.table import Table
from rich.text import Text

from nethawk_tui.widgets import format_time, format_uptime


STATUS_COLORS = {
    "healthy": "green",
    "info": "cyan",
    "warning": "yellow",
    "critical": "red",
    "error": "red",
    "success": "green",
    "idle": "white",
    "running": "yellow",
    "completed": "green",
    "failed": "red",
}


def status_color(status: str) -> str:
    return STATUS_COLORS.get(str(status).lower(), "white")


def metric_style(metric: str, value: float) -> str:
    if metric == "cpu":
        return "red" if value >= 90 else "yellow" if value >= 75 else "green"
    if metric == "memory":
        return "red" if value >= 90 else "yellow" if value >= 80 else "green"
    if metric == "disk":
        return "red" if value >= 90 else "yellow" if value >= 75 else "green"
    return "cyan"


def render_sidebar(active: str):
    items = [
        ("dashboard", "d", "Dashboard"),
        ("doctor", "o", "Doctor"),
        ("scan", "s", "Port Scan"),
        ("bandwidth", "b", "Bandwidth"),
        ("history", "h", "History"),
        ("settings", "g", "Settings"),
        ("help", "?", "Help"),
    ]
    table = Table.grid(padding=(0, 1))
    table.add_column(justify="center", width=3)
    table.add_column()
    for key, shortcut, label in items:
        style = "bold cyan" if active == key else "dim white"
        marker = ">" if active == key else " "
        table.add_row(Text(marker, style=style), Text(f"{label} [{shortcut}]", style=style))
    return Panel(table, title="NAV", border_style="cyan", box=box.ROUNDED)


def render_topbar(status: str, latency: dict, refreshed_at: str):
    color = status_color(status)
    latency_ms = latency.get("latency_ms")
    latency_label = f"{latency_ms} ms" if latency_ms is not None else "unavailable"
    line = Text.assemble(
        ("NetHawk", "bold cyan"),
        ("  |  ", "dim"),
        ("Status: ", "white"),
        (status.title(), f"bold {color}"),
        ("  |  ", "dim"),
        (f"Latency: {latency_label}", "white"),
        ("  |  ", "dim"),
        (f"Refresh: {refreshed_at}", "dim"),
    )
    return Panel(line, border_style="bright_blue", box=box.ROUNDED)


def metric_panel(label: str, value: str, percent: float | None = None, style: str = "cyan"):
    content = Table.grid(expand=True)
    content.add_column()
    content.add_row(Text(value, style=f"bold {style}", justify="center"))
    if percent is not None:
        content.add_row(ProgressBar(total=100, completed=max(0, min(100, percent)), width=24))
    return Panel(content, title=label, border_style=style, box=box.ROUNDED)


def render_dashboard(snapshot: dict, pulse: int = 0):
    latency = snapshot["latency"]
    latency_ms = latency.get("latency_ms")
    latency_text = f"{latency_ms} ms" if latency_ms is not None else "unavailable"
    latency_signal = str(latency.get("status", "unknown"))
    if latency.get("cached"):
        latency_signal = f"{latency_signal} cached"
    uptime = format_uptime(snapshot["uptime_seconds"])
    pulse_text = "LIVE" if pulse % 2 == 0 else "SYNC"

    table = Table(title="Local System + Network Health", box=box.ROUNDED, expand=True, border_style="cyan")
    table.add_column("Metric", style="bold")
    table.add_column("Value", justify="right")
    table.add_column("Signal")
    table.add_row(
        "CPU",
        Text(f"{snapshot['cpu']:.1f}%", style=metric_style("cpu", snapshot["cpu"])),
        ProgressBar(total=100, completed=snapshot["cpu"], width=24),
    )
    table.add_row(
        "Memory",
        Text(f"{snapshot['memory']:.1f}%", style=metric_style("memory", snapshot["memory"])),
        ProgressBar(total=100, completed=snapshot["memory"], width=24),
    )
    table.add_row(
        "Disk",
        Text(f"{snapshot['disk']:.1f}%", style=metric_style("disk", snapshot["disk"])),
        ProgressBar(total=100, completed=snapshot["disk"], width=24),
    )
    table.add_row("Upload", Text(f"{snapshot['upload']:.2f} Mbps", style="green"), Text("outbound", style="green"))
    table.add_row("Download", Text(f"{snapshot['download']:.2f} Mbps", style="blue"), Text("inbound", style="blue"))
    table.add_row("Latency", latency_text, Text(latency_signal, style=status_color(latency.get("status", "info"))))
    table.add_row("Uptime", uptime, Text("local machine", style="dim"))
    note = Panel(
        Text.assemble(
            (pulse_text, "bold cyan"),
            ("  "),
            ("Auto-refresh every 1.25s. Press r for a forced latency refresh.", "dim"),
        ),
        border_style="dim",
        box=box.ROUNDED,
    )
    return Group(table, note)


def render_doctor(result: dict):
    panels = []
    for card in result.get("cards", []):
        color = status_color(card.get("severity", "info"))
        evidence = "\n".join(f"[dim]-[/dim] {item}" for item in card.get("evidence", []))
        actions = "\n".join(f"[dim]-[/dim] {item}" for item in card.get("suggested_actions", []))
        body = (
            f"[bold]Possible cause[/bold]\n{card.get('possible_cause', 'Unavailable')}\n\n"
            f"[bold]Evidence[/bold]\n{evidence or '[dim]No evidence listed[/dim]'}\n\n"
            f"[bold]Suggested actions[/bold]\n{actions or '[dim]No actions listed[/dim]'}"
        )
        panels.append(Panel(body, title=f"{card.get('severity', 'info').upper()} - {card.get('title', 'Diagnosis')}", border_style=color, box=box.ROUNDED))

    if not panels:
        panels.append(Panel("No diagnosis available.", border_style="yellow", box=box.ROUNDED))
    return Group(*panels)


def render_history(activities: list[dict]):
    table = Table(title="Recent Activity", box=box.ROUNDED, expand=True, border_style="cyan")
    table.add_column("Time", style="dim", width=20)
    table.add_column("Type", width=12)
    table.add_column("Status", width=10)
    table.add_column("Message")
    if not activities:
        table.add_row("-", "system", "info", "No activity has been recorded yet.")
        return table
    for item in activities:
        status = str(item.get("status", "info"))
        table.add_row(
            str(item.get("time") or format_time(item.get("timestamp"))),
            str(item.get("type", "event")),
            Text(status, style=status_color(status)),
            str(item.get("message", "")),
        )
    return table


def render_scan(scan_state: dict):
    summary = Table.grid(expand=True)
    summary.add_column(ratio=1)
    summary.add_column(ratio=2)
    status = scan_state.get("status", "idle")
    summary.add_row("Status", Text(str(status).upper(), style=status_color(status)))
    summary.add_row("Target", str(scan_state.get("target") or "127.0.0.1"))
    summary.add_row("Ports", str(scan_state.get("ports") or "22,80,443"))
    summary.add_row("Message", str(scan_state.get("message") or "Enter target and ports, then press Start Scan."))

    results = Table(title="Scan Results", box=box.ROUNDED, expand=True, border_style="cyan")
    results.add_column("Port", justify="right", width=8)
    results.add_column("Protocol", width=10)
    results.add_column("State", width=12)
    results.add_column("Service")
    results.add_column("Risk", width=12)

    rows = scan_state.get("results") or []
    if not rows:
        results.add_row("-", "-", "-", "No scan results yet", "-")
    else:
        for row in rows:
            risk = str(row.get("risk", "info"))
            results.add_row(
                str(row.get("port", "")),
                str(row.get("protocol", "TCP")),
                str(row.get("state", "")),
                str(row.get("service", "unknown")),
                Text(risk, style=status_color("critical" if risk == "critical" else "warning" if risk == "warning" else "info")),
            )

    return Group(
        Panel(summary, title="Port Scan", border_style=status_color(status), box=box.ROUNDED),
        results,
        Panel("Use fields below. Press Start Scan or hit Enter in the ports field.", border_style="dim", box=box.ROUNDED),
    )


def render_bandwidth(snapshot: dict, peaks: dict):
    table = Table(title="Bandwidth Monitor", box=box.ROUNDED, expand=True, border_style="cyan")
    table.add_column("Metric", style="bold")
    table.add_column("Current", justify="right")
    table.add_column("Peak This Session", justify="right")
    table.add_row("Upload", f"{snapshot['upload']:.2f} Mbps", f"{peaks.get('upload', 0):.2f} Mbps")
    table.add_row("Download", f"{snapshot['download']:.2f} Mbps", f"{peaks.get('download', 0):.2f} Mbps")
    table.add_row("Latency", f"{snapshot['latency'].get('latency_ms') or 'unavailable'} ms", str(snapshot["latency"].get("status", "unknown")))
    return Group(
        table,
        Panel("Live psutil counters. Peaks reset when the TUI restarts.", border_style="dim", box=box.ROUNDED),
    )


def render_settings(settings: dict, message: str = ""):
    network = settings.get("network", {}) if isinstance(settings, dict) else {}
    thresholds = settings.get("thresholds", {}) if isinstance(settings, dict) else {}
    table = Table(title="Current Settings", box=box.ROUNDED, expand=True, border_style="cyan")
    table.add_column("Setting", style="bold")
    table.add_column("Value")
    table.add_row("Latency target", str(network.get("latency_target", "8.8.8.8")))
    table.add_row("Latency port", str(network.get("latency_port", 53)))
    table.add_row("CPU threshold", f"{thresholds.get('cpu', 80)}%")
    table.add_row("Memory threshold", f"{thresholds.get('memory', 85)}%")
    table.add_row("Latency threshold", f"{thresholds.get('latency', 250)} ms")
    return Group(
        table,
        Panel(message or "Edit fields below and press Save Settings.", border_style="dim", box=box.ROUNDED),
    )


def render_help():
    table = Table(title="Keyboard Shortcuts", box=box.ROUNDED, expand=True, border_style="cyan")
    table.add_column("Key", style="bold cyan", width=10)
    table.add_column("Action")
    table.add_row("q", "Quit NetHawk")
    table.add_row("r", "Refresh current data")
    table.add_row("d", "Open Dashboard")
    table.add_row("o", "Open Network Doctor")
    table.add_row("s", "Open Port Scan")
    table.add_row("b", "Open Bandwidth")
    table.add_row("h", "Open History")
    table.add_row("g", "Open Settings")
    table.add_row("Up/Down", "Move through sidebar")
    table.add_row("Enter", "Refresh/open current screen")
    table.add_row("?", "Open Help")
    return Group(
        table,
        Panel(
            Align.left(
                "Phase 3B includes local port scanning, bandwidth monitoring, and persistent settings. Flask is not required."
            ),
            border_style="dim",
            box=box.ROUNDED,
        ),
    )
