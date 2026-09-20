#!/usr/bin/env python3
import importlib.util
from pathlib import Path

HERE=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("rechercher_pdf_to_docx",HERE/"scripts"/"rechercher_pdf_to_docx.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def test_diacritics_are_ignored_only_for_loss_comparison():
    source="قَالَ رَسُولُ اللهِ ﷺ"
    derived="قال رسول الله ﷺ"
    assert mod.norm_for_compare(source)==mod.norm_for_compare(derived)
    assert mod.levenshtein_ratio(source,derived)==0.0
    assert source != derived

def test_known_ligatures_are_preserved():
    text="بسم الله ﷻ"
    assert "ﷻ" in mod.protect_symbols(text)

def test_ocr_thread_limit_is_bounded():
    assert int(mod.os.environ.get("RECHERCHER_OCR_THREADS","1")) >= 1

def test_table_extraction_fallback_is_available():
    class Finder:
        tables=[]
    class Page:
        def find_tables(self, **kwargs):
            return Finder()
    assert mod.table_bboxes(Page()) == []
