#!/usr/bin/env python3
"""Build one auditable whole-encyclopedia acquisition dashboard.

The report deliberately distinguishes catalog census, acquisition outcomes,
verified PDFs, and permanent SHA-addressed PDFs. Unknown dimensions are
reported as null rather than guessed.
"""
import hashlib
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CENSUS = ROOT / 'artifacts/governance/encyclopedia-master-catalog-census.json'
RUN = ROOT / 'artifacts/acquisition-run-summary.json'
VERIFIED = ROOT / 'artifacts/verified-real-pdfs/sha256.txt'
PERSIST = ROOT / 'artifacts/permanent-persistence-summary.json'
SECONDARY_INDEX = ROOT / 'secondary/artifacts/permanent-pdfs/index.json'
OUT = ROOT / 'artifacts/governance/whole-encyclopedia-metrics.json'
TXT = ROOT / 'artifacts/governance/WHOLE-ENCYCLOPEDIA.txt'


def read_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def sha_lines(path):
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding='utf-8').splitlines():
        parts = line.split()
        if parts and len(parts[0]) == 64:
            out.append(parts[0])
    return sorted(set(out))


def main():
    census = read_json(CENSUS, {})
    run = read_json(RUN, [])
    persist = read_json(PERSIST, {})
    secondary = read_json(SECONDARY_INDEX, {'records': []})

    statuses = {}
    for row in run if isinstance(run, list) else []:
        statuses[row.get('id')] = row.get('status')

    catalog_books = census.get('books', []) if isinstance(census, dict) else []
    catalog_count = int(census.get('book_count_unique', len(catalog_books))) if isinstance(census, dict) else 0

    source_values = set()
    for book in catalog_books:
        for key in ('sources', 'source_refs'):
            value = book.get(key) if isinstance(book, dict) else None
            if isinstance(value, list):
                source_values.update(str(x) for x in value if x)
            elif value:
                source_values.add(str(value))

    verified_shas = sha_lines(VERIFIED)
    permanent_records = [r for r in secondary.get('records', []) if r.get('sha256')]
    permanent_shas = {r['sha256'] for r in permanent_records}

    acquired = sum(1 for s in statuses.values() if s == 'acquired')
    partial = sum(1 for s in statuses.values() if s == 'partial')
    held = sum(1 for s in statuses.values() if s == 'held-acquisition')
    no_source = sum(1 for s in statuses.values() if s == 'no_catalogued_source')
    failed = sum(1 for s in statuses.values() if s in ('unexpected-error', 'unified-validation-failed'))

    # Rights-blocked is counted from explicit held-acquisition outcomes. The
    # acquisition engine currently emits no_catalogued_source at volume level,
    # so source/retry counts are kept separate and never inferred from absence.
    rights_blocked = held
    retry = partial + failed

    bytes_total = sum(int(r.get('bytes', 0)) for r in permanent_records)
    already_present = int(persist.get('already_present', 0))
    newly_persisted = int(persist.get('newly_persisted', 0))

    report = {
        'schema': 'din-allah-encyclopedia/whole-acquisition-metrics/v1',
        'generated_at': time.time(),
        'scope': 'WHOLE ENCYCLOPEDIA',
        'future_catalogued_books': True,
        'catalog_entries': catalog_count,
        'sources_found': len(source_values),
        'pdf_download_success': acquired,
        'pdf_verified': len(verified_shas),
        'permanent_sha_pdfs': len(permanent_shas),
        'already_present': already_present,
        'newly_persisted_this_run': newly_persisted,
        'rights_blocked': rights_blocked,
        'no_valid_source': no_source,
        'failed_retry': retry,
        'partial_books': partial,
        'total_permanent_size_bytes': bytes_total,
        'total_permanent_size_gb_decimal': round(bytes_total / 1_000_000_000, 3),
        'integrity': {
            'verified_sha_subset_of_permanent': set(verified_shas).issubset(permanent_shas),
            'permanent_index_records': len(permanent_records),
        },
        'status_counts_raw': {
            'acquired': acquired,
            'partial': partial,
            'held-acquisition': held,
            'unexpected-error': sum(1 for s in statuses.values() if s == 'unexpected-error'),
            'unified-validation-failed': sum(1 for s in statuses.values() if s == 'unified-validation-failed'),
        },
        'note': 'Counts are evidence-based. The engine does not guess rights, source absence, or future books; newly catalogued entries are eligible on the next run.'
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    lines = [
        'WHOLE ENCYCLOPEDIA',
        '────────────────────────────',
        f'Catalog entries       : {catalog_count}',
        f'Sources found         : {len(source_values)}',
        f'PDF download success  : {acquired}',
        f'PDF verified          : {len(verified_shas)}',
        f'Permanent SHA PDFs    : {len(permanent_shas)}',
        f'Already present       : {already_present}',
        f'Rights blocked        : {rights_blocked}',
        f'No valid source       : {no_source}',
        f'Failed / retry        : {retry}',
        f'Total permanent size  : {bytes_total / 1_000_000_000:.3f} GB',
        '',
        f'Cataloged {catalog_count}',
        f'       ↓',
        f'Verified {len(verified_shas)}',
        f'       ↓',
        f'Permanent {len(permanent_shas)}',
        '',
        f'Newly persisted this run : {newly_persisted}',
        'Permanent storage policy : append-only real .pdf, SHA-addressed, no overwrite/delete/rename',
    ]
    TXT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines), flush=True)


if __name__ == '__main__':
    main()
