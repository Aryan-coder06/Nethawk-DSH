from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from core.diagnosis_engine import generate_diagnosis


def titles(result: dict) -> set[str]:
    return {card["title"] for card in result["cards"]}


def assert_has(result: dict, title: str) -> None:
    assert title in titles(result), f"Expected card {title!r}, got {titles(result)}"


def main() -> int:
    healthy = generate_diagnosis(
        metrics={"cpu": 20, "memory": 40, "upload": 1, "download": 2, "network": 3},
        latency={"latency_ms": 25, "target": "8.8.8.8", "status": "ok", "error": None},
    )
    assert healthy["overall_status"] == "healthy"
    assert_has(healthy, "System and network look healthy")

    congestion = generate_diagnosis(
        metrics={"cpu": 30, "memory": 50, "upload": 40, "download": 5, "network": 45},
        latency={"latency_ms": 210, "target": "8.8.8.8", "status": "degraded", "error": None},
    )
    assert_has(congestion, "High latency with heavy upload")

    ssh = generate_diagnosis(
        metrics={"cpu": 20, "memory": 40, "upload": 1, "download": 1, "network": 2},
        latency={"latency_ms": 20, "target": "8.8.8.8", "status": "ok", "error": None},
        scan_result={"open_ports": [22, 80]},
    )
    assert_has(ssh, "SSH remote access exposed")

    cpu_bottleneck = generate_diagnosis(
        metrics={"cpu": 92, "memory": 45, "upload": 1, "download": 1, "network": 2},
        latency={"latency_ms": 25, "target": "8.8.8.8", "status": "ok", "error": None},
    )
    assert_has(cpu_bottleneck, "Local system bottleneck")

    unavailable = generate_diagnosis(
        metrics={"cpu": 20, "memory": 40, "upload": 1, "download": 1, "network": 2},
        latency={"latency_ms": None, "target": "bad.target", "status": "unavailable", "error": "timed out"},
    )
    assert_has(unavailable, "Latency target unavailable")

    print("Diagnosis verification passed")
    print("Sample warning output:")
    print(congestion)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
