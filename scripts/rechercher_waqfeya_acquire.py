#!/usr/bin/env python3
"""Compatibility entry point for Rechercher real-PDF acquisition.

The old Waqfeya-specific implementation is intentionally disabled.  This
entry point remains only so existing scheduled workflows do not break while
migrating to the independent provider-neutral engine.
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

ENGINE = Path(__file__).resolve().with_name("rechercher_acquisition_engine.py")
sys.argv = [str(ENGINE)] + sys.argv[1:]
runpy.run_path(str(ENGINE), run_name="__main__")
