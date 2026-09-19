#!/usr/bin/env python3
"""Compatibility entry point: Waqfeya discovery -> unified Rechercher downloader."""
from __future__ import annotations
import runpy, sys
from pathlib import Path
ENGINE = Path(__file__).resolve().with_name("rechercher_unified_pdf_acquisition.py")
sys.argv = [str(ENGINE)] + sys.argv[1:]
runpy.run_path(str(ENGINE), run_name="__main__")
