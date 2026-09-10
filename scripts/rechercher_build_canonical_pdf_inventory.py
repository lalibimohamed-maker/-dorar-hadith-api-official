#!/usr/bin/env python3
"""Build the authoritative book-by-book PDF inventory from the cumulative manifest.

The manifest is the source of truth for acquisition metadata. Every acquired
record is deduplicated by the plaintext PDF SHA-256. The first record becomes
the canonical copy and later records with the same digest are retained as
aliases, never counted as another PDF.

This tool does not publish anything and does not alter rights decisions.
"""
import argparse
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--manifest', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--vault', default=None)
    args = p.parse_args()

    manifest_path = Path(args.manifest)
    out_path = Path(args.out)
    if not manifest_path.exists() or manifest_path.stat().st_size == 0:
        raise SystemExit('ERROR: cumulative developer-review manifest is missing or empty')

    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    records = manifest.get('records', [])
    if not isinstance(records, list):
        raise SystemExit('ERROR: manifest.records is not a list')

    by_sha = {}
    books = []
    missing_sha = 0
    invalid_records = 0

    for record in records:
        acquired = record.get('acquired', []) or []
        if not isinstance(acquired, list):
            invalid_records += 1
            continue
        for item in acquired:
            digest = (item.get('sha256') or '').lower().strip()
            if len(digest) != 64:
                missing_sha += 1
                continue
            entry = {
                'book_id': record.get('id'),
                'title': record.get('title'),
                'author': record.get('author'),
                'author_death_hijri': record.get('author_death_hijri'),
                'edition': record.get('edition'),
                'source': item.get('source'),
                'source_url': item.get('url'),
                'bytes': item.get('bytes'),
                'sha256': digest,
                'validation': item.get('validation', {}),
                'rights_action': record.get('rights_action'),
                'catalog_rights_status': record.get('catalog_rights_status'),
                'manifest_status': item.get('status'),
            }
            current = by_sha.get(digest)
            if current is None:
                by_sha[digest] = {
                    'sha256': digest,
                    'bytes': item.get('bytes'),
                    'canonical': entry,
                    'aliases': [],
                }
            else:
                current['aliases'].append(entry)

    for digest, group in sorted(by_sha.items(), key=lambda kv: (kv[1]['canonical'].get('title') or '', kv[0])):
        canonical = group['canonical']
        books.append({
            'ordinal': len(books) + 1,
            'sha256': digest,
            'bytes': group.get('bytes'),
            'title': canonical.get('title'),
            'author': canonical.get('author'),
            'author_death_hijri': canonical.get('author_death_hijri'),
            'book_id': canonical.get('book_id'),
            'source': canonical.get('source'),
            'source_url': canonical.get('source_url'),
            'rights_action': canonical.get('rights_action'),
            'catalog_rights_status': canonical.get('catalog_rights_status'),
            'validation': canonical.get('validation'),
            'duplicate_sha256_count': len(group['aliases']),
            'aliases': group['aliases'],
        })

    counts = {
        'manifest_records': len(records),
        'unique_pdf_sha256': len(books),
        'duplicate_pdf_records': sum(len(x['aliases']) for x in by_sha.values()),
        'records_without_sha256': missing_sha,
        'invalid_records': invalid_records,
    }

    result = {
        'schema': 'din-allah-encyclopedia/canonical-pdf-inventory/v1',
        'source_of_truth': 'developer-review-manifest.json',
        'deduplication': 'SHA-256 of acquired plaintext PDF',
        'rights_policy': 'inventory does not grant redistribution rights; publication remains fail-closed',
        'counts': counts,
        'books': books,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('CANONICAL_PDF_INVENTORY_COUNTS=' + json.dumps(counts, ensure_ascii=False, sort_keys=True))


if __name__ == '__main__':
    main()
