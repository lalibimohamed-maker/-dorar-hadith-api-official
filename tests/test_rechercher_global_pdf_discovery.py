#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts/rechercher_materialize_master_catalog.py"
spec = importlib.util.spec_from_file_location("rechercher_materialize_master_catalog", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GlobalPdfDiscoveryTests(unittest.TestCase):
    def test_provider_registry_is_global_and_typed(self):
        names = {p["name"] for p in module.PROVIDER_REGISTRY}
        for required in ("Internet Archive", "Waqfeya", "Google Books", "Open Library", "Wikimedia Commons", "Wikisource", "Library of Congress", "Gallica", "Qatar Digital Library", "HathiTrust", "WorldCat", "DPLA"):
            self.assertIn(required, names)
        self.assertTrue(any(p["kind"] == "metadata" for p in module.PROVIDER_REGISTRY))
        self.assertTrue(any(p["kind"] == "pdf" for p in module.PROVIDER_REGISTRY))

    def test_merge_sources_deduplicates_normalized_urls(self):
        existing = [{"url": "https://example.org/a.pdf", "label": "old"}]
        additions = [
            {"url": "https://example.org/a.pdf", "label": "duplicate"},
            {"url": "https://example.org/b.pdf", "label": "new"},
        ]
        merged = module.merge_sources(existing, additions)
        self.assertEqual([x["url"] for x in merged], ["https://example.org/a.pdf", "https://example.org/b.pdf"])
        self.assertEqual(merged[0]["label"], "old")

    def test_discovery_does_not_replace_existing_sources(self):
        book = {"id": "already-sourced", "title": "كتاب موجود", "sources": [{"url": "https://example.org/existing.pdf", "label": "catalog"}]}
        result = module.discover_sources(book)
        self.assertEqual(result["sources"], book["sources"])

    def test_metadata_indexes_never_become_rights_grants(self):
        evidence = module.metadata_candidates("كتاب", "مؤلف")
        self.assertTrue(evidence)
        self.assertTrue(all(item["metadata_only"] for item in evidence))
        self.assertTrue(all(item["rights_grant"] is False for item in evidence))

    def test_zero_candidate_state_is_explicit(self):
        original = module.provider_calls
        try:
            module.provider_calls = lambda *_: []
            result = module.discover_sources({"id": "x", "title": "كتاب غير موجود"})
        finally:
            module.provider_calls = original
        self.assertEqual(result["source_discovery"]["candidate_count"], 0)
        self.assertEqual(result["source_discovery"]["status"], "no-pdf-candidate-found")
        self.assertEqual(result["source_discovery"]["discovery_version"], "global-worldwide-pdf-v2")

    def test_pdf_candidate_requires_rights_review(self):
        original = module.provider_calls
        try:
            module.provider_calls = lambda *_: [("Test PDF", lambda *_: [{"url": "https://example.org/book.pdf", "pdf_url": "https://example.org/book.pdf", "provider": "Test PDF", "rights_review_required": True}])]
            result = module.discover_sources({"id": "x", "title": "كتاب"})
        finally:
            module.provider_calls = original
        self.assertTrue(result["sources"][0]["rights_review_required"])
        self.assertFalse(result["discovery_evidence"]["redistribution_rights_granted"])


if __name__ == "__main__":
    unittest.main()
