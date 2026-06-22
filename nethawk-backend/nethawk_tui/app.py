from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.reactive import reactive
from textual.widgets import Button, Input, Static
from textual.worker import Worker

from core.port_scan import run_local_port_scan
from metrics_store import metrics_store
from nethawk_tui.screens import (
    render_bandwidth,
    render_dashboard,
    render_doctor,
    render_help,
    render_history,
    render_scan,
    render_sidebar,
    render_settings,
    render_topbar,
)
from nethawk_tui.widgets import (
    collect_dashboard_snapshot,
    collect_doctor_snapshot,
    current_settings,
    format_time,
    recent_activities,
    save_tui_settings,
)


NAV_ORDER = ["dashboard", "doctor", "scan", "bandwidth", "history", "settings", "help"]


class NetHawkTUI(App):
    CSS_PATH = "theme.tcss"
    BINDINGS = [
        ("q", "quit", "Quit"),
        ("r", "refresh", "Refresh"),
        ("d", "show_dashboard", "Dashboard"),
        ("o", "show_doctor", "Doctor"),
        ("s", "show_scan", "Scan"),
        ("b", "show_bandwidth", "Bandwidth"),
        ("h", "show_history", "History"),
        ("g", "show_settings", "Settings"),
        ("?", "show_help", "Help"),
        ("up", "nav_previous", "Previous"),
        ("down", "nav_next", "Next"),
        ("enter", "refresh", "Open"),
    ]

    active_screen = reactive("dashboard")
    status = reactive("healthy")
    last_message = reactive("Ready")
    latency = reactive({"latency_ms": None, "status": "unavailable"})
    refreshed_at = reactive("--:--:--")
    refresh_count = reactive(0)
    refresh_in_progress = False
    scan_running = False
    scan_state = {
        "status": "idle",
        "target": "127.0.0.1",
        "ports": "22,80,443",
        "message": "Ready",
        "results": [],
    }
    bandwidth_peaks = {"upload": 0.0, "download": 0.0}
    settings_message = ""

    def compose(self) -> ComposeResult:
        with Container(id="root"):
            yield Static(id="topbar")
            with Horizontal(id="body"):
                yield Static(id="sidebar")
                with Vertical(id="main_area"):
                    yield Static(id="content")
                    with Vertical(id="scan_form", classes="form"):
                        yield Static("Target host/IP", classes="field_label")
                        yield Input(value="127.0.0.1", placeholder="Target host/IP", id="scan_target")
                        yield Static("Ports or range", classes="field_label")
                        yield Input(value="22,80,443", placeholder="Ports e.g. 22,80,443 or 1-100", id="scan_ports")
                        yield Button("Start Scan", id="scan_start", variant="primary")
                    with Horizontal(id="settings_form", classes="form"):
                        yield Input(placeholder="Latency target", id="set_latency_target")
                        yield Input(placeholder="Latency port", id="set_latency_port")
                        yield Input(placeholder="CPU %", id="set_cpu")
                        yield Input(placeholder="Memory %", id="set_memory")
                        yield Input(placeholder="Latency ms", id="set_latency")
                        yield Button("Save Settings", id="settings_save", variant="primary")
            yield Static(id="bottombar")

    def on_mount(self) -> None:
        self.update_forms()
        self.refresh_data(force_latency=True)
        self.set_interval(1.25, self.refresh_data)

    def refresh_chrome(self) -> None:
        self.query_one("#topbar", Static).update(render_topbar(self.status, self.latency, self.refreshed_at))
        self.query_one("#sidebar", Static).update(render_sidebar(self.active_screen))
        self.query_one("#bottombar", Static).update(
            f" {self.last_message} | q r d o s b h g ? | arrows nav"
        )
        self.update_forms()

    def update_forms(self) -> None:
        scan_form = self.query_one("#scan_form")
        settings_form = self.query_one("#settings_form")
        scan_visible = self.active_screen == "scan"
        settings_visible = self.active_screen == "settings"
        scan_form.styles.display = "block" if scan_visible else "none"
        settings_form.styles.display = "block" if settings_visible else "none"
        for widget in scan_form.query("Input, Button"):
            widget.disabled = not scan_visible
        for widget in settings_form.query("Input, Button"):
            widget.disabled = not settings_visible

    def refresh_data(self, force_latency: bool = False) -> None:
        if self.refresh_in_progress:
            return
        self.refresh_in_progress = True
        if force_latency:
            self.last_message = "Refreshing..."
            self.refresh_chrome()
        screen = self.active_screen
        self.run_worker(lambda: self.load_screen_data(screen, force_latency), thread=True)

    def load_screen_data(self, screen: str, force_latency: bool = False) -> dict:
        try:
            if screen == "dashboard":
                return {"screen": screen, "snapshot": collect_dashboard_snapshot(force_latency=force_latency)}
            if screen == "doctor":
                return {"screen": screen, "doctor": collect_doctor_snapshot(force_latency=force_latency)}
            if screen == "scan":
                return {"screen": screen, "scan": self.scan_state}
            if screen == "bandwidth":
                return {"screen": screen, "snapshot": collect_dashboard_snapshot(force_latency=force_latency)}
            if screen == "history":
                return {"screen": screen, "activities": recent_activities()}
            if screen == "settings":
                return {"screen": screen, "settings": current_settings()}
            return {"screen": "help"}
        except Exception as exc:
            return {"screen": screen, "error": str(exc)}

    def on_worker_state_changed(self, event: Worker.StateChanged) -> None:
        if event.worker.state.name != "SUCCESS":
            if event.worker.state.name in {"ERROR", "CANCELLED"}:
                self.refresh_in_progress = False
            return

        payload = event.worker.result
        self.refresh_in_progress = False
        self.refresh_count += 1

        if payload.get("kind") == "scan_result":
            result = payload["result"]
            self.scan_running = False
            self.scan_state.update({
                "status": result.get("status", "failed"),
                "target": result.get("target", self.scan_state.get("target")),
                "ports": result.get("ports", self.scan_state.get("ports")),
                "message": result.get("message", ""),
                "results": result.get("results", []),
                "open_ports": result.get("open_ports", []),
            })
            if result.get("status") == "completed":
                metrics_store.add_activity(
                    "scan",
                    f"TUI port scan completed for {result.get('target')}: {len(result.get('open_ports', []))} open port(s)",
                    "success",
                    host=result.get("target"),
                    ports=result.get("ports"),
                    open_ports=result.get("open_ports", []),
                )
            else:
                metrics_store.add_activity(
                    "scan",
                    f"TUI port scan failed for {result.get('target')}: {result.get('message')}",
                    "error",
                    host=result.get("target"),
                    ports=result.get("ports"),
                )
            if self.active_screen == "scan":
                self.query_one("#content", Static).update(render_scan(self.scan_state))
            self.status = "healthy" if result.get("status") == "completed" else "warning"
            self.refreshed_at = format_time()
            self.last_message = result.get("message", "Scan finished")
            self.refresh_chrome()
            return

        if payload.get("error"):
            self.status = "warning"
            self.query_one("#content", Static).update(f"Data unavailable: {payload['error']}")
            self.last_message = "Data unavailable"
            self.refresh_chrome()
            return

        screen = payload["screen"]
        if screen != self.active_screen and screen != "help":
            return

        if screen == "dashboard":
            snapshot = payload["snapshot"]
            self.latency = snapshot["latency"]
            self.status = "healthy" if self.latency.get("status") == "ok" else "warning"
            self.refreshed_at = format_time(snapshot["timestamp"])
            self.query_one("#content", Static).update(render_dashboard(snapshot, pulse=self.refresh_count))
            self.last_message = "Live dashboard updated"
        elif screen == "doctor":
            result = payload["doctor"]
            self.status = result.get("overall_status", "info")
            self.latency = result.get("dashboard", {}).get("latency", self.latency)
            self.refreshed_at = format_time()
            self.query_one("#content", Static).update(render_doctor(result))
            self.last_message = f"Doctor status: {self.status}"
        elif screen == "scan":
            self.query_one("#content", Static).update(render_scan(payload["scan"]))
            self.refreshed_at = format_time()
            self.last_message = f"Scan: {self.scan_state.get('status', 'idle')}"
        elif screen == "bandwidth":
            snapshot = payload["snapshot"]
            self.latency = snapshot["latency"]
            self.bandwidth_peaks["upload"] = max(self.bandwidth_peaks["upload"], snapshot["upload"])
            self.bandwidth_peaks["download"] = max(self.bandwidth_peaks["download"], snapshot["download"])
            self.status = "healthy" if self.latency.get("status") == "ok" else "warning"
            self.refreshed_at = format_time(snapshot["timestamp"])
            self.query_one("#content", Static).update(render_bandwidth(snapshot, self.bandwidth_peaks))
            self.last_message = "Bandwidth updated"
        elif screen == "history":
            self.query_one("#content", Static).update(render_history(payload["activities"]))
            self.refreshed_at = format_time()
            self.last_message = "History refreshed"
        elif screen == "settings":
            self.query_one("#content", Static).update(render_settings(payload["settings"], self.settings_message))
            self.fill_settings_form(payload["settings"])
            self.refreshed_at = format_time()
            self.last_message = "Settings loaded"
        else:
            self.query_one("#content", Static).update(render_help())
            self.refreshed_at = format_time()
            self.last_message = "Help"
        self.refresh_chrome()

    def switch_to(self, screen: str) -> None:
        self.active_screen = screen
        self.refresh_data()
        self.update_forms()

    def fill_settings_form(self, settings: dict) -> None:
        network = settings.get("network", {}) if isinstance(settings, dict) else {}
        thresholds = settings.get("thresholds", {}) if isinstance(settings, dict) else {}
        self.query_one("#set_latency_target", Input).value = str(network.get("latency_target", "8.8.8.8"))
        self.query_one("#set_latency_port", Input).value = str(network.get("latency_port", 53))
        self.query_one("#set_cpu", Input).value = str(thresholds.get("cpu", 80))
        self.query_one("#set_memory", Input).value = str(thresholds.get("memory", 85))
        self.query_one("#set_latency", Input).value = str(thresholds.get("latency", 250))

    def action_nav_previous(self) -> None:
        index = NAV_ORDER.index(self.active_screen)
        self.switch_to(NAV_ORDER[(index - 1) % len(NAV_ORDER)])

    def action_nav_next(self) -> None:
        index = NAV_ORDER.index(self.active_screen)
        self.switch_to(NAV_ORDER[(index + 1) % len(NAV_ORDER)])

    def action_refresh(self) -> None:
        self.refresh_data(force_latency=True)

    def action_show_dashboard(self) -> None:
        self.switch_to("dashboard")

    def action_show_doctor(self) -> None:
        self.switch_to("doctor")

    def action_show_scan(self) -> None:
        self.switch_to("scan")

    def action_show_bandwidth(self) -> None:
        self.switch_to("bandwidth")

    def action_show_history(self) -> None:
        self.switch_to("history")

    def action_show_settings(self) -> None:
        self.switch_to("settings")

    def action_show_help(self) -> None:
        self.switch_to("help")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "scan_start":
            self.start_scan()
        elif event.button.id == "settings_save":
            self.save_settings()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id in {"scan_target", "scan_ports"}:
            self.start_scan()
        elif event.input.id and event.input.id.startswith("set_"):
            self.save_settings()

    def on_input_changed(self, event: Input.Changed) -> None:
        if event.input.id not in {"scan_target", "scan_ports"} or self.active_screen != "scan":
            return

        target = self.query_one("#scan_target", Input).value.strip()
        ports = self.query_one("#scan_ports", Input).value.strip()
        if self.scan_state.get("status") != "running":
            self.scan_state.update({
                "status": "idle",
                "target": target,
                "ports": ports,
                "message": "Editing scan inputs. Press Enter in a field or Start Scan.",
                "results": [],
            })
            self.query_one("#content", Static).update(render_scan(self.scan_state))
            self.last_message = "Editing scan inputs"
            self.refresh_chrome()

    def start_scan(self) -> None:
        if self.scan_running:
            self.last_message = "Scan already running"
            self.refresh_chrome()
            return
        target = self.query_one("#scan_target", Input).value.strip()
        ports = self.query_one("#scan_ports", Input).value.strip()
        self.scan_state.update({"status": "running", "target": target, "ports": ports, "message": "Scan running...", "results": []})
        metrics_store.add_activity("scan", f"TUI port scan started for {target} on {ports}", "info", host=target, ports=ports)
        self.scan_running = True
        self.query_one("#content", Static).update(render_scan(self.scan_state))
        self.last_message = "Scan running"
        self.refresh_chrome()
        self.run_worker(lambda: {"kind": "scan_result", "result": run_local_port_scan(target, ports)}, thread=True)

    def save_settings(self) -> None:
        values = {
            "latency_target": self.query_one("#set_latency_target", Input).value,
            "latency_port": self.query_one("#set_latency_port", Input).value,
            "cpu": self.query_one("#set_cpu", Input).value,
            "memory": self.query_one("#set_memory", Input).value,
            "latency": self.query_one("#set_latency", Input).value,
        }
        ok, message, settings = save_tui_settings(values)
        self.settings_message = message
        self.status = "healthy" if ok else "warning"
        self.query_one("#content", Static).update(render_settings(settings, message))
        self.last_message = message
        self.refresh_chrome()


def main() -> None:
    NetHawkTUI().run()


if __name__ == "__main__":
    main()
