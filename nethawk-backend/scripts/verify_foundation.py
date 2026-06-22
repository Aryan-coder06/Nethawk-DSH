from pathlib import Path
import sys
import tempfile


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from core.latency import measure_latency
from metrics_store import MetricsStore


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp_dir:
        store_path = Path(tmp_dir) / "store.json"

        store = MetricsStore(local_file=store_path)
        saved = store.set_settings({
            "network": {
                "latency_target": "8.8.8.8",
                "latency_port": 53,
            },
            "thresholds": {
                "cpu": 80,
            },
        })
        assert saved["updated_at"]

        store.add_activity("system", "verification event", "success")

        reloaded = MetricsStore(local_file=store_path)
        assert reloaded.get_settings()["network"]["latency_target"] == "8.8.8.8"
        assert reloaded.get_activities()[0]["message"] == "verification event"

    latency = measure_latency(timeout=0.75)
    assert set(["latency_ms", "target", "status", "error"]).issubset(latency.keys())
    assert latency["status"] in {"ok", "degraded", "unavailable"}

    print("Foundation verification passed")
    print(f"Latency result: {latency}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
