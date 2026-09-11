#!/usr/bin/env python3
"""Final pre-persistence safety gate for Rechercher acquired PDFs.

This gate runs after acquisition and before encryption/persistence. It is deliberately
stricter than the candidate searcher: a PDF must be a real PDF, pass qpdf, have
sufficient pages/bytes, match the catalog title+author from PDF text (not URL alone),
not duplicate another book's SHA-256 in the current run, and not reuse a SHA already
associated with a different book in the review manifest.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ARABIC_DIACRITICS = re.compile(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]')
STOP = set('من في على عن إلى الى و أو او ثم بن ابن أبو ابي أبي ام أم هذا هذه ذلك تلك كتاب كتب جزء مجلد تحقيق شرح دار طبعة الطبعة'.split())


def normalize_text(value):
    import unicodedata
    s = unicodedata.normalize('NFKC', value or '')
    s = ARABIC_DIACRITICS.sub('', s).replace('ـ', '')
    s = s.translate(str.maketrans({'أ':'ا','إ':'ا','آ':'ا','ٱ':'ا','ى':'ي','ة':'ه','ؤ':'و','ئ':'ي'}))
    s = s.lower().replace('_', ' ')
    s = re.sub(r'[^\w\u0600-\u06ff]+', ' ', s, flags=re.UNICODE)
    return re.sub(r'\s+', ' ', s).strip()


def tokens(value):
    return [t for t in normalize_text(value).split() if len(t) >= 2 and t not in STOP]


def overlap(needles, hay):
    n = set(needles)
    return len(n & set(tokens(hay))) / max(1, len(n))


def sha256_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def pdf_stats(path):
    q = subprocess.run(['qpdf', '--check', str(path)], text=True, capture_output=True)
    if q.returncode != 0:
        return False, 0, 'qpdf_failed: ' + (q.stdout + q.stderr).strip()
    r = subprocess.run(['pdfinfo', str(path)], text=True, capture_output=True)
    if r.returncode != 0:
        return False, 0, 'pdfinfo_failed: ' + (r.stdout + r.stderr).strip()
    pages = 0
    for line in r.stdout.splitlines():
        if line.lower().startswith('pages:'):
            try:
                pages = int(line.split(':', 1)[1].strip())
            except ValueError:
                pages = 0
            break
    return True, pages, ''


def first_pages_text(path):
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.txt') as tmp:
        r = subprocess.run(
            ['pdftotext', '-f', '1', '-l', '8', '-layout', str(path), tmp.name],
            text=True, capture_output=True, timeout=120,
        )
        if r.returncode != 0:
            return ''
        return Path(tmp.name).read_text(encoding='utf-8', errors='replace')


def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def catalog_books(root, catalog, discoveries):
    by_id = {}
    cat = load_json(root / catalog)
    for b in cat.get('books', []):
        if b.get('id'):
            by_id[str(b['id'])] = dict(b)
    for rel in discoveries:
        p = root / rel
        if not p.exists():
            continue
        try:
            data = load_json(p)
        except Exception:
            continue
        for e in data.get('entries', []):
            if not e.get('id'):
                continue
            cur = by_id.setdefault(str(e['id']), {})
            for key, value in e.items():
                if value not in (None, '', [], {}):
                    cur.setdefault(key, value)
    return by_id


def previous_sha_index(root, review_branch, manifest_path):
    if not review_branch:
        return {}
    spec = f'origin/{review_branch}:{manifest_path}'
    try:
        raw = subprocess.check_output(['git', 'show', spec], text=True, stderr=subprocess.DEVNULL)
    except Exception:
        return {}
    try:
        data = json.loads(raw)
    except Exception:
        return {}
    out = {}
    for rec in data.get('records', []):
        rid = str(rec.get('id') or '')
        if not rid:
            continue
        for item in rec.get('acquired', []) or []:
            digest = str(item.get('sha256') or '')
            if digest:
                out.setdefault(digest, set()).add(rid)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--root', required=True)
    p.add_argument('--manifest', required=True)
    p.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
    p.add_argument('--review-branch', default='')
    p.add_argument('--min-pages', type=int, default=8)
    p.add_argument('--min-bytes', type=int, default=131072)
    p.add_argument('--discovery', action='append', default=[])
    args = p.parse_args()

    root = Path(args.root).resolve()
    manifest_path = root / args.manifest
    manifest = load_json(manifest_path)
    records = {str(r.get('id')): r for r in manifest.get('records', []) if r.get('id')}
    books = catalog_books(root, args.catalog, args.discovery)
    prior = previous_sha_index(root, args.review_branch, args.manifest)

    failures = []
    sha_to_ids = {}
    checked = 0

    for rid, rec in records.items():
        acquired = rec.get('acquired', []) or []
        book = books.get(rid, rec)
        expected = int(book.get('expected_volumes') or 1)
        if expected > 1 and len(acquired) != expected:
            failures.append(f'{rid}: incomplete multi-volume acquisition {len(acquired)}/{expected}')
        if expected == 1 and len(acquired) != 1:
            failures.append(f'{rid}: expected one acquired copy, found {len(acquired)}')

        title = str(book.get('title') or rec.get('title') or '')
        author = str(book.get('author') or rec.get('author') or '')
        title_tokens = tokens(title)
        author_tokens = tokens(author)
        for item in acquired:
            path_value = item.get('local_path')
            if not path_value:
                failures.append(f'{rid}: acquired item missing local_path')
                continue
            path = root / path_value
            if not path.exists():
                failures.append(f'{rid}: missing acquired file {path_value}')
                continue
            checked += 1
            if path.stat().st_size < args.min_bytes:
                failures.append(f'{rid}: suspiciously small PDF {path_value} bytes={path.stat().st_size}')
                continue
            ok, pages, detail = pdf_stats(path)
            if not ok:
                failures.append(f'{rid}: {detail}')
                continue
            if pages < args.min_pages:
                failures.append(f'{rid}: suspiciously few pages {pages} in {path_value}')
            text = first_pages_text(path)
            title_score = overlap(title_tokens, text)
            author_score = overlap(author_tokens, text) if author_tokens else 1.0
            title_required = 0.60 if len(set(title_tokens)) < 4 else 0.50
            if title_score < title_required:
                failures.append(f'{rid}: PDF-text title evidence too weak score={title_score:.3f}')
            if author_tokens and author_score < 0.50:
                failures.append(f'{rid}: PDF-text author evidence too weak score={author_score:.3f}')
            digest = str(item.get('sha256') or '') or sha256_file(path)
            if item.get('sha256') and item.get('sha256') != digest:
                failures.append(f'{rid}: manifest SHA mismatch')
            sha_to_ids.setdefault(digest, set()).add(rid)
            prior_ids = prior.get(digest, set()) - {rid}
            if prior_ids:
                failures.append(f'{rid}: SHA256 already associated with different prior book ids {sorted(prior_ids)}: {digest}')

    for digest, ids in sha_to_ids.items():
        if len(ids) > 1:
            failures.append(f'cross-book duplicate SHA256 {digest}: ids={sorted(ids)}')

    print(json.dumps({
        'schema': 'din-allah-encyclopedia/rechercher-pdf-safety-gate/v1',
        'checked_files': checked,
        'failure_count': len(failures),
        'failures': failures[:200],
    }, ensure_ascii=False, indent=2))
    if failures:
        print('PDF_SAFETY_GATE=FAIL', file=sys.stderr)
        for failure in failures:
            print('SAFETY-REJECT ' + failure, file=sys.stderr)
        return 1
    print('PDF_SAFETY_GATE=PASS')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
