#!/usr/bin/env python3
import pathlib, re

root = pathlib.Path(__file__).resolve().parents[1]
unified = (root / "scripts/rechercher_unified_pdf_acquisition.py").read_text()
waqfeya = (root / "scripts/rechercher_waqfeya_acquire.py").read_text()
sequential = (root / "scripts/rechercher_sequential_acquisition.py").read_text()
workflow = (root / ".github/workflows/rechercher-developer-review-acquisition.yml").read_text()

assert 'rechercher_acquisition_engine.py' in unified
assert 'RECHERCHER_UNIFIED_ACQUISITION' in unified
assert 'rechercher_unified_pdf_acquisition.py' in waqfeya
assert 'rechercher_unified_pdf_acquisition.py' in sequential
assert 'rechercher_unified_pdf_acquisition.py --root "$GITHUB_WORKSPACE"' in workflow
assert 'REVIEW_VAULT_KEY' in workflow
assert 'openssl enc -aes-256-cbc -pbkdf2' in workflow
assert 'never_infer_redistribution_rights' in (root / "config/rechercher-pdf-rights-routing.json").read_text()
print("UNIFIED_PDF_ACQUISITION_ENTRYPOINT=PASS")
print("WAQFEYA_COMPATIBILITY_ROUTED=PASS")
print("SEQUENTIAL_COMPATIBILITY_ROUTED=PASS")
print("DEVELOPER_REVIEW_WORKFLOW_ROUTED=PASS")
print("VAULT_ENCRYPTION=PASS")
print("RIGHTS_ROUTING_POLICY=PASS")
