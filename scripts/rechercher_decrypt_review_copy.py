#!/usr/bin/env python3
"""Decrypt one retained developer-review PDF locally.

Never stores or accepts the vault key in source control. Supply it through
REVIEW_VAULT_KEY in the environment.
"""
import argparse, os, subprocess
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('encrypted', type=Path)
p.add_argument('output', type=Path)
a=p.parse_args()
key=os.environ.get('REVIEW_VAULT_KEY')
if not key:
    raise SystemExit('REVIEW_VAULT_KEY is required in the environment.')
if not a.encrypted.is_file():
    raise SystemExit(f'Encrypted file not found: {a.encrypted}')
a.output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([
    'openssl','enc','-d','-aes-256-cbc','-pbkdf2','-md','sha256',
    '-pass','env:REVIEW_VAULT_KEY','-in',str(a.encrypted),'-out',str(a.output)
],check=True)
print(a.output)
