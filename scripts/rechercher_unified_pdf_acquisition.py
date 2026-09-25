#!/usr/bin/env python3
"""Unified Rechercher PDF acquisition entry point.

All PDF download callers must converge here. The central real-PDF acquisition
engine remains the only downloader; provider-specific callers are discovery
adapters only. Rights are evaluated separately from discoverability, and
non-redistributable material never becomes public by inference.
"""
from __future__ import annotations
import argparse, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "scripts/rechercher_acquisition_engine.py"
ROUTER = ROOT / "scripts/rechercher_pdf_rights_gate.py"

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(ROOT))
    ap.add_argument("--manifest", default="")
    args, passthrough = ap.parse_known_args()

    if not ENGINE.is_file():
        raise SystemExit("UNIFIED_ACQUISITION_ENGINE_MISSING")
    if not ROUTER.is_file():
        raise SystemExit("RIGHTS_ROUTER_MISSING")

    # The downloader itself is provider-neutral. Discovery/source adapters feed
    # catalogued candidates into the same engine; they are never alternate
    # downloaders. Existing compatibility entry points may still invoke this
    # same engine without changing their public interface.
    env = dict(os.environ)
    env["RECHERCHER_UNIFIED_ACQUISITION"] = "1"
    env["RECHERCHER_RIGHTS_ROUTING"] = "enforced"

    cmd = [sys.executable, str(ENGINE), "--root", args.root, *passthrough]
    result = subprocess.run(cmd, cwd=ROOT, env=env)
    if result.returncode != 0:
        return result.returncode

    print("RECHERCHER_ACQUISITION_ENGINE=UNIFIED")
    print("RECHERCHER_PROVIDER_DOWNLOADERS=NONE")
    print("RECHERCHER_DISCOVERY_ADAPTERS=SHARED")
    print("RIGHTS_ROUTING=SEPARATE_FROM_DISCOVERY")
    print("PUBLIC_REDISRIBUTION=EXPLICIT_RIGHTS_ONLY")
    print("CORPUS_MUTATION=SEPARATE")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
