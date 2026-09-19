# Waqfeya harvest retry — 2026-09-02

This commit intentionally triggers the Waqfeya acquisition workflow after repairing dynamic book discovery and PDF-link extraction.

The previous run reached the Waqfeya job but discovered 0 candidates because the old parser only matched static `href` links from the legacy `top.php?st=` layout. The repaired harvester also scans the current `latest.php`, `top.php`, homepage, absolute/relative `/books/` strings, and archive.org PDF URLs, while preserving the explicit-rights gate.

Expected result: a non-zero discovery count or a diagnostic manifest explaining the exact remaining source-side blocker; never silently report an unexplained empty batch.
