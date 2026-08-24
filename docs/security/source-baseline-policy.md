# Source Refresh Baseline Policy

Baselines are security metadata, not source content.

A baseline may record identifiers, approved host metadata, timestamps, byte counts, hashes, and other narrowly scoped verification metadata. It must not contain copied source text, documents, HTML, PDFs, or other authoritative Corpus material.

Baseline changes are subject to pull-request review and automated validation. A refresh must never be able to silently rewrite its own trust baseline.