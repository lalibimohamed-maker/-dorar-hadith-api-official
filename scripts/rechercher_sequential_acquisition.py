#!/usr/bin/env python3
"""Governed wrapper for the central real-PDF acquisition engine."""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/rechercher_materialize_master_catalog.py"
GOVERNED_BUILDER = ROOT / ".governance-source/scripts/rechercher_materialize_master_catalog.py"
VOLUME_RESOLVER = ROOT / "scripts/rechercher_resolve_volume_evidence.py"
GOVERNED_VOLUME_RESOLVER = ROOT / ".governance-source/scripts/rechercher_resolve_volume_evidence.py"
ENGINE = ROOT / "scripts/rechercher_acquisition_engine.py"
RETRYABLE_STATUSES = {"blocked-missing-expected-volumes", "partial"}


def run_checked(path: Path, *args: str):
    return subprocess.run([sys.executable, str(path), *args], cwd=ROOT, check=True)


def acquired_ids() -> set[str]:
    found: set[str] = set()
    artifacts = ROOT / "artifacts"
    for manifest in artifacts.glob("*.manifest.json"):
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except Exception:
            continue
        if data.get("acquisition") != "acquired" or data.get("pdf") != "real+validated":
            continue
        unified = data.get("unified_file")
        if not unified or not (ROOT / unified).is_file():
            continue
        if data.get("id"):
            found.add(str(data["id"]))
    return found


def prepare_pending_only_catalog(acquired: set[str]):
    """Temporarily expose only pending books; restore all catalogs afterward."""
    catalogs = sorted((ROOT / "books-batches").glob("**/catalog.json"))
    if not acquired or not catalogs:
        return None
    backup_root = ROOT / ".rechercher-catalog-backup"
    backup_root.mkdir(parents=True, exist_ok=True)
    backups = []
    for catalog in catalogs:
        rel = catalog.relative_to(ROOT)
        backup = backup_root / rel
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(catalog), str(backup))
        backups.append((catalog, backup))
    master_original = next((b for c, b in backups if c == ROOT / "books-batches/encyclopedia-master/catalog.json"), None)
    if master_original is None:
        raise RuntimeError("materialized master catalog missing")
    data = json.loads(master_original.read_text(encoding="utf-8"))
    pending = [b for b in data.get("books", []) if str(b.get("id") or "") not in acquired]
    filtered = dict(data)
    filtered["books"] = pending
    filtered["queue_filter"] = {
        "mode": "pending-only",
        "skipped_acquired": len(data.get("books", [])) - len(pending),
        "pending": len(pending),
        "manifest_gate": "acquired + real+validated + unified_file exists",
    }
    master = ROOT / "books-batches/encyclopedia-master/catalog.json"
    master.parent.mkdir(parents=True, exist_ok=True)
    master.write_text(json.dumps(filtered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ACQUIRED_QUEUE_SKIPPED={len(data.get('books', [])) - len(pending)}", flush=True)
    print(f"ACQUIRED_QUEUE_PENDING={len(pending)}", flush=True)
    return backups


def restore_catalogs(backups):
    if not backups:
        return
    for catalog, backup in reversed(backups):
        catalog.unlink(missing_ok=True)
        catalog.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(backup), str(catalog))
    shutil.rmtree(ROOT / ".rechercher-catalog-backup", ignore_errors=True)


def main() -> int:
    # Always take the builder/resolver from the reviewed main checkout. The
    # target branch is persistent state, not the source of executable policy.
    if not GOVERNED_BUILDER.is_file():
        raise SystemExit(f"missing governed master catalog materializer: {GOVERNED_BUILDER}")
    shutil.copy2(GOVERNED_BUILDER, BUILDER)
    run_checked(BUILDER)

    if not GOVERNED_VOLUME_RESOLVER.is_file():
        raise SystemExit(f"missing governed volume-evidence resolver: {GOVERNED_VOLUME_RESOLVER}")
    shutil.copy2(GOVERNED_VOLUME_RESOLVER, VOLUME_RESOLVER)
    run_checked(VOLUME_RESOLVER)

    if not ENGINE.is_file():
        raise SystemExit(f"missing governed real-PDF acquisition engine: {ENGINE}")

    backups = None
    try:
        backups = prepare_pending_only_catalog(acquired_ids())
        engine_result = subprocess.run([sys.executable, str(ENGINE), *sys.argv[1:]], cwd=ROOT, check=False)
    finally:
        restore_catalogs(backups)

    if engine_result.returncode == 0:
        return 0

    summary_path = ROOT / "artifacts" / "acquisition-run-summary.json"
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    except Exception:
        return engine_result.returncode
    if not isinstance(summary, list) or not summary:
        return engine_result.returncode
    items = [item for item in summary if isinstance(item, dict)]
    statuses = {str(item.get("status")) for item in items}
    retryable = sum(1 for item in items if item.get("status") in RETRYABLE_STATUSES)
    acquired = sum(1 for item in items if item.get("status") == "acquired")
    terminal_failures = statuses - RETRYABLE_STATUSES - {"acquired"}
    if statuses and not terminal_failures:
        print(f"ACQUISITION_PROGRESS_OK acquired={acquired} retryable={retryable} total={len(items)}", flush=True)
        if retryable:
            print(f"RETRYABLE_ACQUISITION_GAPS={retryable} (kept pending for the next scheduled pass)", flush=True)
        return 0
    return engine_result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
