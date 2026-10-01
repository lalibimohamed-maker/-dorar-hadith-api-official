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

def test_arabic_two_column_order_is_right_column_first():
    blocks=[
        {"bbox":(20,100,200,130),"text":"left","kind":"digital"},
        {"bbox":(420,100,600,130),"text":"right","kind":"digital"},
    ]
    ordered=mod._order_blocks_reading(blocks,612)
    assert ordered[0]["text"]=="right"
    assert ordered[1]["text"]=="left"

def test_docx_zero_byte_guard():
    import tempfile
    p=Path(tempfile.mkstemp(suffix=".docx")[1])
    try:
        assert mod.validate_docx(p) is False
    finally:
        p.unlink(missing_ok=True)

if __name__ == "__main__":
    test_diacritics_are_ignored_only_for_loss_comparison()
    test_known_ligatures_are_preserved()
    test_ocr_thread_limit_is_bounded()
    test_table_extraction_fallback_is_available()
    print("python PDF-DOCX regression tests: OK")
