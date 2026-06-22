from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


DEFAULT_THRESHOLDS = {
    "cpu_warning": 80,
    "memory_warning": 85,
    "latency_warning": 150,
    "upload_warning": 25,
    "network_warning": 40,
    "low_network": 5,
    "many_open_ports": 8,
    "frequent_alerts": 3,
}

SEVERITY_RANK = {
    "healthy": 0,
    "info": 1,
    "warning": 2,
    "critical": 3,
}


def _number(value: Any, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _thresholds(settings: dict[str, Any] | None) -> dict[str, float]:
    thresholds = dict(DEFAULT_THRESHOLDS)
    configured = (settings or {}).get("thresholds", {})
    if isinstance(configured, dict):
        thresholds["cpu_warning"] = _number(configured.get("cpu"), thresholds["cpu_warning"])
        thresholds["memory_warning"] = _number(configured.get("memory"), thresholds["memory_warning"])
        thresholds["latency_warning"] = _number(configured.get("latency"), thresholds["latency_warning"])
        thresholds["network_warning"] = _number(configured.get("bandwidth"), thresholds["network_warning"])
    doctor = (settings or {}).get("doctor", {})
    if isinstance(doctor, dict):
        for key in ["upload_warning", "low_network", "many_open_ports", "frequent_alerts"]:
            thresholds[key] = _number(doctor.get(key), thresholds[key])
    return thresholds


def _card(
    severity: str,
    title: str,
    possible_cause: str,
    evidence: list[str],
    suggested_actions: list[str],
) -> dict[str, Any]:
    return {
        "severity": severity,
        "title": title,
        "possible_cause": possible_cause,
        "evidence": evidence,
        "suggested_actions": suggested_actions,
    }


def _open_ports(scan_result: dict[str, Any] | None) -> list[int]:
    if not scan_result:
        return []

    raw_ports = scan_result.get("open_ports", [])
    ports: list[int] = []
    for item in raw_ports:
        if isinstance(item, dict):
            item = item.get("port") or item.get("number")
        try:
            ports.append(int(item))
        except (TypeError, ValueError):
            continue
    return sorted(set(ports))


def _recent_problem_events(activities: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    problem_statuses = {"warning", "critical", "error"}
    events = []
    for activity in activities or []:
        if str(activity.get("status", "")).lower() in problem_statuses:
            events.append(activity)
    return events


def _overall_status(cards: list[dict[str, Any]]) -> str:
    if not cards:
        return "healthy"
    return max((card["severity"] for card in cards), key=lambda severity: SEVERITY_RANK[severity])


def generate_diagnosis(
    metrics: dict[str, Any],
    latency: dict[str, Any],
    activities: list[dict[str, Any]] | None = None,
    scan_result: dict[str, Any] | None = None,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    thresholds = _thresholds(settings)

    cpu = _number(metrics.get("cpu"))
    memory = _number(metrics.get("memory"))
    upload = _number(metrics.get("upload"))
    download = _number(metrics.get("download"))
    network_total = _number(metrics.get("network"), upload + download)
    if network_total == 0:
        network_total = upload + download

    latency_ms = latency.get("latency_ms")
    latency_value = _number(latency_ms) if latency_ms is not None else None
    latency_status = str(latency.get("status", "unavailable"))

    high_cpu = cpu >= thresholds["cpu_warning"]
    high_memory = memory >= thresholds["memory_warning"]
    high_latency = latency_value is not None and latency_value >= thresholds["latency_warning"]
    high_upload = upload >= thresholds["upload_warning"]
    high_network = network_total >= thresholds["network_warning"]
    low_network = network_total <= thresholds["low_network"]
    cards: list[dict[str, Any]] = []

    if latency_status == "unavailable" or latency_value is None:
        cards.append(_card(
            "warning",
            "Latency target unavailable",
            "The target may be unreachable because of DNS failure, firewall rules, or network restrictions.",
            [
                f"Latency status is {latency_status}",
                f"Target is {latency.get('target', 'unknown')}",
                f"Error: {latency.get('error') or 'not provided'}",
            ],
            [
                "Try a different latency target such as 1.1.1.1 or your router IP",
                "Check DNS and firewall settings",
                "Verify the machine has internet access",
            ],
        ))

    if high_latency and high_upload:
        cards.append(_card(
            "warning",
            "High latency with heavy upload",
            "Background upload, cloud sync, or congestion may be increasing response time.",
            [
                f"Latency is {latency_value} ms",
                f"Upload bandwidth is {upload} Mbps",
                f"CPU usage is {cpu}%",
            ],
            [
                "Pause large uploads or cloud sync",
                "Check apps consuming network bandwidth",
                "Restart the router if the issue continues",
            ],
        ))
    elif high_latency and not high_cpu and not high_network:
        cards.append(_card(
            "warning",
            "High latency without local load",
            "The issue may be outside this machine, such as router, ISP, DNS, or Wi-Fi quality.",
            [
                f"Latency is {latency_value} ms",
                f"CPU usage is normal at {cpu}%",
                f"Network usage is {network_total} Mbps",
            ],
            [
                "Test latency to your router and a public DNS server",
                "Switch from Wi-Fi to Ethernet if possible",
                "Check ISP status or router health",
            ],
        ))

    if high_cpu and high_network:
        cards.append(_card(
            "warning",
            "High CPU with heavy network activity",
            "A local process may be doing heavy transfer work or unexpected background activity.",
            [
                f"CPU usage is {cpu}%",
                f"Total network usage is {network_total} Mbps",
            ],
            [
                "Inspect running processes by CPU and network usage",
                "Pause downloads, sync tools, or package managers",
                "Check for unexpected background services",
            ],
        ))
    elif high_cpu and low_network:
        cards.append(_card(
            "warning",
            "Local system bottleneck",
            "The machine is under CPU pressure, but the network is not busy.",
            [
                f"CPU usage is {cpu}%",
                f"Total network usage is only {network_total} Mbps",
            ],
            [
                "Close CPU-heavy local applications",
                "Check build tools, browsers, or background jobs",
                "Retest network after CPU load drops",
            ],
        ))

    if high_memory:
        cards.append(_card(
            "warning",
            "Memory pressure detected",
            "High memory usage can slow local tools and make diagnostics less responsive.",
            [
                f"Memory usage is {memory}%",
            ],
            [
                "Close unused applications",
                "Check memory-heavy browser tabs or services",
                "Restart long-running local processes if needed",
            ],
        ))

    open_ports = _open_ports(scan_result)
    if 22 in open_ports:
        cards.append(_card(
            "warning",
            "SSH remote access exposed",
            "Port 22 is open, so SSH access may be reachable from this network.",
            [
                "Port 22 is open in the latest scan",
            ],
            [
                "Confirm SSH is required",
                "Use key-based authentication and disable password login",
                "Restrict SSH access with firewall rules",
            ],
        ))

    if 3389 in open_ports:
        cards.append(_card(
            "critical",
            "Remote Desktop exposure risk",
            "Port 3389 is open, which can expose Remote Desktop access.",
            [
                "Port 3389 is open in the latest scan",
            ],
            [
                "Disable Remote Desktop if not needed",
                "Restrict access to trusted IPs",
                "Use VPN or network-level authentication",
            ],
        ))

    if len(open_ports) >= thresholds["many_open_ports"]:
        cards.append(_card(
            "warning",
            "Increased attack surface",
            "Many open ports increase the number of services that need hardening.",
            [
                f"{len(open_ports)} open ports found in the latest scan",
                f"Open ports: {', '.join(str(port) for port in open_ports)}",
            ],
            [
                "Close services that are not required",
                "Review firewall rules",
                "Document why each exposed service must remain open",
            ],
        ))

    problem_events = _recent_problem_events(activities)
    if len(problem_events) >= thresholds["frequent_alerts"]:
        cards.append(_card(
            "warning",
            "Frequent recent alerts",
            "Repeated warning or error events suggest an unstable system or network condition.",
            [
                f"{len(problem_events)} warning/error events found in recent activity",
            ],
            [
                "Review the activity history for repeated patterns",
                "Check whether alerts happen during a specific workload",
                "Lower background network and CPU load before retesting",
            ],
        ))

    if not cards:
        cards.append(_card(
            "healthy",
            "System and network look healthy",
            "No rule detected a current bottleneck or exposure from the available data.",
            [
                f"CPU usage is {cpu}%",
                f"Memory usage is {memory}%",
                f"Latency status is {latency_status}",
                f"Network usage is {network_total} Mbps",
            ],
            [
                "Continue monitoring",
                "Run a port scan when you want exposure analysis",
            ],
        ))

    return {
        "overall_status": _overall_status(cards),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cards": cards,
    }
