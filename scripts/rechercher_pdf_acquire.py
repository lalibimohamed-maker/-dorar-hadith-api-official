#!/usr/bin/env python3
"""Provider-neutral entry point for the central Rechercher PDF engine.

The legacy worker is loaded only as an implementation module. Source selection
is overridden here so no provider is privileged or treated as a mandatory gate.
The worker still performs the established real-PDF signature and qpdf checks.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEGACY = Path(__file__).with_name('rechercher_waqfeya_acquire_original.py')

spec = importlib.util.spec_from_file_location('rechercher_pdf_worker', LEGACY)
if spec is None or spec.loader is None:
    raise SystemExit(f'Cannot load central PDF worker: {LEGACY}')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def provider_neutral_sources(book):
    """Return every catalogued source without provider-specific preference."""
    candidates = []
    for source in book.get('sources', []):
        if isinstance(source, str):
            candidates.append({'url': source, 'label': 'catalogued-source', 'discover_pdfs': True})
        elif isinstance(source, dict) and source.get('url'):
            candidates.append(dict(source))
    for key in ('source_url', 'url'):
        if book.get(key):
            candidates.append({'url': book[key], 'label': key, 'discover_pdfs': True})

    unique, seen = [], set()
    for candidate in candidates:
        url = worker.normalize_url(candidate['url'])
        if url in seen:
            continue
        seen.add(url)
        candidate['url'] = url
        unique.append(candidate)
    return unique


worker.source_candidates = provider_neutral_sources
worker.MAX_SOURCE_ATTEMPTS = max(12, int(__import__('os').environ.get('RECHERCHER_MAX_SOURCE_ATTEMPTS', '24')))

if __name__ == '__main__':
    print('[RECHERCHER PDF] provider-neutral acquisition engine enabled', flush=True)
    worker.main()
