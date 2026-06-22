import socket
import time
from typing import Any


DEFAULT_LATENCY_TARGET = "8.8.8.8"
DEFAULT_LATENCY_PORT = 53


def measure_latency(target: str = DEFAULT_LATENCY_TARGET, port: int = DEFAULT_LATENCY_PORT, timeout: float = 1.5) -> dict[str, Any]:
    """
    Measures TCP connect latency. This avoids raw ICMP ping, which often needs
    elevated permissions and is unreliable in locked-down environments.
    """
    target = (target or DEFAULT_LATENCY_TARGET).strip()
    started = time.perf_counter()

    try:
        with socket.create_connection((target, int(port)), timeout=timeout):
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
    except OSError as exc:
        return {
            "latency_ms": None,
            "target": target,
            "port": int(port),
            "status": "unavailable",
            "error": str(exc),
        }

    if latency_ms <= 120:
        status = "ok"
    elif latency_ms <= 250:
        status = "degraded"
    else:
        status = "unavailable"

    return {
        "latency_ms": latency_ms,
        "target": target,
        "port": int(port),
        "status": status,
        "error": None,
    }


def latency_settings(settings: dict[str, Any]) -> tuple[str, int]:
    network = settings.get("network", {}) if isinstance(settings, dict) else {}
    target = network.get("latency_target") or network.get("dns_target") or DEFAULT_LATENCY_TARGET
    try:
        port = int(network.get("latency_port", DEFAULT_LATENCY_PORT))
    except (TypeError, ValueError):
        port = DEFAULT_LATENCY_PORT
    return str(target), port
