#!/usr/bin/env python3
"""Rechercher Acquisition Engine v2.

Non-destructive post-acquisition inspection/processing layer.
Acquisition remains authoritative: this engine never deletes or replaces an
original PDF and never makes OCR authoritative text.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def tool(name):
    return shutil.which(name)


def run(cmd):
    try:
        p = subprocess.run(cmd, text=True, capture_output=True, timeout=300)
        return p.returncode, (p.stdout + p.stderr).strip()
    except Exception as exc:
        return 99, str(exc)


def sha256(path, chunk=1024 * 1024):
    h = hashlib.sha256()
    with path.open('rb') as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def inspect_pdf(path, tools):
    rec = {
        'path': str(path),
        'bytes': path.stat().st_size,
        'sha256': sha256(path),
        'signature': path.open('rb').read(5) == b'%PDF-',
        'qpdf': None,
        'pdfinfo': None,
        'pages': None,
        'has_text': None,
        'classification': 'unknown',
        'ocr': {'status': 'not-run', 'authoritative': False},
    }
    if not rec['signature']:
        rec['classification'] = 'invalid-signature'
        return rec

    if tools['qpdf']:
        code, out = run([tools['qpdf'], '--check', str(path)])
        rec['qpdf'] = {'exit': code, 'output': out[-4000:]}
        if code not in (0, 3):
            rec['classification'] = 'invalid-pdf'
            return rec

    if tools['pdfinfo']:
        code, out = run([tools['pdfinfo'], str(path)])
        rec['pdfinfo'] = {'exit': code, 'output': out[-6000:]}
        if code == 0:
            for line in out.splitlines():
                if line.lower().startswith('pages:'):
                    try:
                        rec['pages'] = int(line.split(':', 1)[1].strip())
                    except ValueError:
                        pass

    if tools['pdftotext']:
        code, out = run([tools['pdftotext'], '-f', '1', '-l', '3', '-layout', str(path), '-'])
        if code == 0:
            rec['has_text'] = bool(out.strip())

    if rec['qpdf'] and rec['qpdf']['exit'] == 0:
        rec['classification'] = 'text-pdf' if rec['has_text'] is True else ('scanned-pdf' if rec['has_text'] is False else 'valid-pdf')
    elif rec['qpdf'] and rec['qpdf']['exit'] == 3:
        rec['classification'] = 'repairable-pdf'
    else:
        rec['classification'] = 'valid-pdf'
    return rec


def process_ocr(rec, pdf_root, processed_root, tools):
    if rec['classification'] != 'scanned-pdf':
        return
    if not tools['ocrmypdf'] or not tools['tesseract']:
        rec['ocr'] = {'status': 'pending', 'authoritative': False, 'reason': 'ocrmyPDF_or_tesseract_not_installed'}
        return
    src = Path(rec['path'])
    rel = src.relative_to(pdf_root)
    dst = processed_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    code, out = run([tools['ocrmypdf'], '--skip-text', '--deskew', str(src), str(dst)])
    rec['ocr'] = {'status': 'processed' if code == 0 else 'failed', 'authoritative': False, 'exit': code, 'output': out[-4000:]}
    if code != 0:
        dst.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    ap.add_argument('--pdf-root', default='artifacts/developer-review-vault')
    ap.add_argument('--out', default='artifacts/governance/acquisition-engine-v2-manifest.json')
    ap.add_argument('--processed-root', default='artifacts/rechercher-v2-processed')
    ap.add_argument('--ocr', action='store_true', help='run optional OCR on scanned PDFs; failures remain non-fatal')
    args = ap.parse_args()
    root = Path(args.root).resolve()
    pdf_root = (root / args.pdf_root).resolve()
    out = (root / args.out).resolve()
    processed = (root / args.processed_root).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    names = ['qpdf', 'pdfinfo', 'pdftotext', 'ocrmypdf', 'tesseract']
    tools = {n: tool(n) for n in names}
    files = sorted(pdf_root.rglob('*.pdf')) if pdf_root.exists() else []
    records = []
    for path in files:
        try:
            rec = inspect_pdf(path, tools)
            if args.ocr:
                process_ocr(rec, pdf_root, processed, tools)
            records.append(rec)
        except Exception as exc:
            records.append({'path': str(path), 'status': 'inspection-error', 'error': str(exc)})

    counts = {}
    for rec in records:
        key = rec.get('classification', rec.get('status', 'unknown'))
        counts[key] = counts.get(key, 0) + 1
    ocr_counts = {}
    for rec in records:
        key = rec.get('ocr', {}).get('status', 'not-run')
        ocr_counts[key] = ocr_counts.get(key, 0) + 1

    manifest = {
        'schema': 'din-allah-encyclopedia/rechercher-acquisition-engine-v2/v1',
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'policy': {
            'acquisition_is_primary': True,
            'originals_are_immutable': True,
            'ocr_is_authoritative': False,
            'processing_failure_is_non_blocking': True,
        },
        'root': str(pdf_root.relative_to(root)) if pdf_root.is_relative_to(root) else str(pdf_root),
        'tools': tools,
        'counts': counts,
        'ocr_counts': ocr_counts,
        'records': records,
    }
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('ACQUISITION_ENGINE_V2', json.dumps({'files': len(records), 'counts': counts, 'ocr': ocr_counts}, ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    main()
