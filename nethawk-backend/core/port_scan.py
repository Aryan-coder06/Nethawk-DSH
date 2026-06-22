import shutil
import subprocess
import time
import xml.etree.ElementTree as ET
from typing import Any


COMMON_PORT_RISKS = {
    21: ("FTP", "warning"),
    22: ("SSH", "warning"),
    23: ("Telnet", "critical"),
    25: ("SMTP", "info"),
    53: ("DNS", "info"),
    80: ("HTTP", "info"),
    110: ("POP3", "warning"),
    143: ("IMAP", "warning"),
    443: ("HTTPS", "info"),
    3306: ("MySQL", "warning"),
    5432: ("PostgreSQL", "warning"),
    6379: ("Redis", "critical"),
    27017: ("MongoDB", "critical"),
    3389: ("RDP", "critical"),
}


def parse_ports(ports_input: str) -> str:
    ports = []
    for part in (ports_input or "").replace(" ", "").split(","):
        if not part:
            continue
        if "-" in part:
            try:
                start, end = [int(value) for value in part.split("-", 1)]
            except ValueError:
                continue
            if 1 <= start <= end <= 65535:
                ports.append(f"{start}-{end}")
        else:
            try:
                port = int(part)
            except ValueError:
                continue
            if 1 <= port <= 65535:
                ports.append(str(port))
    return ",".join(sorted(set(ports), key=lambda value: int(value.split("-", 1)[0])))


def risk_for_port(port: int, service: str = "") -> str:
    if port in COMMON_PORT_RISKS:
        return COMMON_PORT_RISKS[port][1]
    if service.lower() in {"telnet", "redis", "mongodb"}:
        return "critical"
    return "info"


def label_for_port(port: int, service: str = "") -> str:
    if port in COMMON_PORT_RISKS:
        return COMMON_PORT_RISKS[port][0]
    return service or "unknown"


def _parse_nmap_xml(xml_text: str, target: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    rows = []
    for port_el in root.findall(".//port"):
        port = int(port_el.attrib.get("portid", "0"))
        protocol = port_el.attrib.get("protocol", "tcp").upper()
        state_el = port_el.find("state")
        service_el = port_el.find("service")
        state = state_el.attrib.get("state", "unknown") if state_el is not None else "unknown"
        service = service_el.attrib.get("name", "") if service_el is not None else ""
        label = label_for_port(port, service)
        rows.append({
            "port": port,
            "protocol": protocol,
            "state": state,
            "service": label,
            "risk": risk_for_port(port, service),
            "target": target,
        })
    return sorted(rows, key=lambda row: row["port"])


def run_local_port_scan(target: str, ports_input: str, timeout: int = 45) -> dict[str, Any]:
    target = (target or "").strip()
    ports = parse_ports(ports_input)
    started = time.time()

    if not target:
        return {"status": "failed", "message": "Target host/IP is required.", "results": []}
    if not ports:
        return {"status": "failed", "message": "At least one valid port is required.", "results": []}
    if shutil.which("nmap") is None:
        return {
            "status": "failed",
            "message": "nmap is not installed or not available in PATH.",
            "results": [],
            "target": target,
            "ports": ports,
        }

    command = ["nmap", "-Pn", "-sT", "-T4", "-p", ports, "-oX", "-", target]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "message": f"Scan timed out after {timeout} seconds.",
            "results": [],
            "target": target,
            "ports": ports,
        }
    except OSError as exc:
        return {
            "status": "failed",
            "message": str(exc),
            "results": [],
            "target": target,
            "ports": ports,
        }

    if completed.returncode != 0:
        return {
            "status": "failed",
            "message": completed.stderr.strip() or f"nmap exited with code {completed.returncode}.",
            "results": [],
            "target": target,
            "ports": ports,
        }

    try:
        results = _parse_nmap_xml(completed.stdout, target)
    except ET.ParseError as exc:
        return {
            "status": "failed",
            "message": f"Could not parse nmap output: {exc}",
            "results": [],
            "target": target,
            "ports": ports,
        }

    open_ports = [row["port"] for row in results if row["state"] == "open"]
    return {
        "status": "completed",
        "message": f"Scan completed: {len(open_ports)} open port(s).",
        "results": results,
        "target": target,
        "ports": ports,
        "open_ports": open_ports,
        "duration_seconds": round(time.time() - started, 2),
    }
