#!/usr/bin/env python3
"""Decrypt one retained developer-review PDF into an ordinary PDF.

The key is supplied only through REVIEW_VAULT_KEY. The encrypted source is
consumed as an input and the resulting plaintext PDF is validated by the
caller; encrypted material is never the retained review format.
"""
import argparse, os, subprocess
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("encrypted", type=Path)
p.add_argument("output", type=Path)
a = p.parse_args()

key = os.environ.get("REVIEW_VAULT_KEY")
if not key:
    raise SystemExit("REVIEW_VAULT_KEY is required only when an encrypted review input is encountered.")
if not a.encrypted.is_file():
    raise SystemExit(f"Encrypted file not found: {a.encrypted}")

a.output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([
    "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-md", "sha256",
    "-pass", "env:REVIEW_VAULT_KEY",
    "-in", str(a.encrypted), "-out", str(a.output)
], check=True)

if a.output.read_bytes()[:5] != b"%PDF-":
    a.output.unlink(missing_ok=True)
    raise SystemExit(f"Decryption did not produce a valid PDF: {a.output}")

print(a.output)
