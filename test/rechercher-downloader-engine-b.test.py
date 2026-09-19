from pathlib import Path
import json
import py_compile
import tempfile
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "scripts/rechercher_downloader_engine_b.py"
REGISTRY = ROOT / "scripts/rechercher_download_task_registry.py"
CONFIG = ROOT / "config/rechercher-downloader-engine-b.json"

assert ENGINE.is_file()
assert REGISTRY.is_file()
assert CONFIG.is_file()

py_compile.compile(str(ENGINE), doraise=True)
py_compile.compile(str(REGISTRY), doraise=True)

policy = json.loads(CONFIG.read_text(encoding="utf-8"))
assert policy["engine"] == "engine-b"
assert policy["safety"]["source_discovery"] == "outside-downloader"
assert policy["safety"]["rights_decision"] == "outside-downloader"
assert policy["features"]["parallel_byte_ranges"] is True
assert policy["features"]["resume"] is True
assert policy["features"]["dedup"] is True

with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    task_file = td / "tasks.jsonl"
    db = td / "tasks.sqlite"
    task_file.write_text(json.dumps({
        "url": "https://example.invalid/book.pdf",
        "output_path": str(td / "book.pdf")
    }) + "\n", encoding="utf-8")
    proc = subprocess.run([
        sys.executable, str(REGISTRY), "--db", str(db), "--jsonl", str(task_file)
    ], capture_output=True, text=True, check=True)
    assert "REGISTRY_ENQUEUED=1" in proc.stdout

print("PASS: Engine B and registry compile and initialize.")
print("PASS: Engine B is downloader-only; discovery and rights stay outside.")
