#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/rechercher_materialize_master_catalog.py"
spec = importlib.util.spec_from_file_location("rechercher_materialize_master_catalog", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GlobalPdfDiscoveryTests(unittest.TestCase):
    def test_merge_sources_deduplicates_normalized_urls(self):
        existing = [{"url": "https://example.org/a.pdf", "label": "old"}]
        additions = [
            {"url": "https://example.org/a.pdf", "label": "duplicate"},
            {"url": "https://example.org/b.pdf", "label": "new"},
        ]
        merged = module.merge_sources(existing, additions)
        self.assertEqual([x["url"] for x in merged], [
            "https://example.org/a.pdf",
            "https://example.org/b.pdf",
        ])
        self.assertEqual(merged[0]["label"], "old")

    def test_discovery_does_not_replace_existing_sources(self):
        book = {
            "id": "already-sourced",
            "title": "كتاب موجود",
            "sources": [{"url": "https://example.org/existing.pdf", "label": "catalog"}],
        }
        result = module.discover_sources(book)
        self.assertEqual(result["sources"], book["sources"])

    def test_discovery_records_zero_candidate_state(self):
        original = module.archive_candidates, module.waqfeya_candidates, module.google_books_candidates, module.openlibrary_candidates
        try:
            module.archive_candidates = lambda *_: []
            module.waqfeya_candidates = lambda *_: []
            module.google_books_candidates = lambda *_: []
            module.openlibrary_candidates = lambda *_: []
            result = module.discover_sources({"id": "x", "title": "كتاب غير موجود"})
        finally:
            module.archive_candidates, module.waqfeya_candidates, module.google_books_candidates, module.openlibrary_candidates = original
        self.assertEqual(result["source_discovery"]["candidate_count"], 0)
        self.assertEqual(result["source_discovery"]["status"], "no-pdf-candidate-found")

    def test_metadata_providers_are_not_rights_grants(self):
        original = module.google_books_candidates
        try:
            module.archive_candidates = lambda *_: []
            module.waqfeya_candidates = lambda *_: []
            module.openlibrary_candidates = lambda *_: []
            module.google_books_candidates = lambda *_: [{
                "url": "https://books.google.example/pdf",
                "pdf_url": "https://books.google.example/pdf",
                "provider": "Google Books",
                "label": "google-books-pdf-discovery",
                "rights_review_required": True,
            }]
            result = module.discover_sources({"id": "x", "title": "كتاب"})
        finally:
            module.google_books_candidates = original
        self.assertTrue(result["sources"][0]["rights_review_required"])
        self.assertEqual(result["source_discovery"]["discovery_version"], "global-pdf-v1")


if __name__ == "__main__":
    unittest.main()
