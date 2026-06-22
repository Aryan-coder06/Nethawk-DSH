import asyncio
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from textual.widgets import Input

from core.port_scan import parse_ports, risk_for_port
from nethawk_tui.app import NetHawkTUI


async def verify_tui() -> None:
    app = NetHawkTUI()
    async with app.run_test() as pilot:
        await pilot.pause(0.8)
        for key, expected in [
            ("o", "doctor"),
            ("s", "scan"),
            ("b", "bandwidth"),
            ("h", "history"),
            ("g", "settings"),
            ("?", "help"),
            ("d", "dashboard"),
        ]:
            await pilot.press(key)
            await pilot.pause(0.1)
            assert app.active_screen == expected

        await pilot.press("s")
        await pilot.pause(0.1)
        app.query_one("#scan_target", Input).value = "127.0.0.1"
        app.query_one("#scan_ports", Input).value = "22,80"
        assert app.active_screen == "scan"

        await pilot.press("g")
        await pilot.pause(0.1)
        app.query_one("#set_latency_target", Input).value = "8.8.8.8"
        app.query_one("#set_latency_port", Input).value = "53"
        app.query_one("#set_cpu", Input).value = "80"
        app.query_one("#set_memory", Input).value = "85"
        app.query_one("#set_latency", Input).value = "250"
        app.save_settings()
        assert "saved" in app.last_message.lower()


def main() -> int:
    assert parse_ports("22,80,1-3,bad") == "1-3,22,80"
    assert risk_for_port(3389) == "critical"
    assert risk_for_port(22) == "warning"
    asyncio.run(verify_tui())
    print("Phase 3B TUI verification passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
