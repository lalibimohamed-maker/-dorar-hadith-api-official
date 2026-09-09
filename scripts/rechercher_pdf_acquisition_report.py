#!/usr/bin/env python3
"""Build a compact, machine-readable report for a Rechercher PDF artifact."""
import argparse
import hashlib
import json
import os
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--manifest', required=True)
    p.add_argument('--pdf-root', required=True)
    p.add_argument('--inventory', required=True)
    p.add_argument('--sha256-list', required=True)
    p.add_argument('--out', required=True)
    a = p.parse_args()

    manifest_path = Path(a.manifest)
    pdf_root = Path(a.pdf_root)
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    records = manifest.get('records', [])
    counts = manifest.get('counts', {})

    pdfs = sorted(pdf_root.glob('*.pdf'))
    observed = {}
    invalid_signature = []
    hash_errors = []
    for pdf in pdfs:
        data = pdf.open('rb')
        try:
            signature = data.read(5)
        finally:
            data.close()
        if signature != b'%PDF-':
            invalid_signature.append(pdf.name)
            continue
        observed[pdf.name] = sha256(pdf)

    manifest_hashes = {}
    expected_paths = {}
    for rec in records:
        for item in rec.get('acquired', []):
            local = Path(str(item.get('local_path', ''))).name
            digest = item.get('sha256')
            if local and digest:
                manifest_hashes[local] = digest
                expected_paths[local] = rec.get('id')

    for name, digest in observed.items():
        expected = manifest_hashes.get(name)
        if expected and expected.lower() != digest.lower():
            hash_errors.append({'file': name, 'book_id': expected_paths.get(name), 'manifest_sha256': expected, 'observed_sha256': digest})

    missing_files = sorted(set(manifest_hashes) - set(observed))
    untracked_files = sorted(set(observed) - set(manifest_hashes))
    failed_books = counts.get('global_search_no_match', 0)
    acquired_books = counts.get('acquired_books', 0)
    total_books = counts.get('books', len(records))

    report = {
        'schema': 'din-allah-encyclopedia/rechercher-pdf-acquisition-report/v1',
        'workflow_run_id': os.environ.get('GITHUB_RUN_ID'),
        'workflow': os.environ.get('GITHUB_WORKFLOW'),
        'commit': os.environ.get('GITHUB_SHA'),
        'artifact_name': f"rechercher-validated-pdfs-{os.environ.get('GITHUB_RUN_ID', 'unknown')}",
        'scope': {
            'workflow': 'developer-review-pdf-acquisition',
            'classification': 'batch',
            'note': 'This artifact is a developer-review acquisition batch; it must not be interpreted as the complete whole-encyclopedia corpus.'
        },
        'counts': {
            'catalog_books': total_books,
            'acquired_books': acquired_books,
            'acquired_files_manifest': counts.get('acquired_files', 0),
            'pdf_files_in_artifact': len(pdfs),
            'valid_pdf_signatures': len(observed),
            'invalid_pdf_signatures': len(invalid_signature),
            'missing_files_from_manifest': len(missing_files),
            'untracked_pdf_files': len(untracked_files),
            'sha256_mismatches': len(hash_errors),
            'failed_or_not_acquired_books': failed_books,
            'books_with_acquisition_gap': total_books - acquired_books,
        },
        'integrity': {
            'all_pdf_signatures_valid': not invalid_signature,
            'all_manifest_hashes_match': not hash_errors,
            'all_manifest_files_present': not missing_files,
            'no_untracked_pdfs': not untracked_files,
        },
        'files': {
            'missing': missing_files,
            'untracked': untracked_files,
            'invalid_signature': invalid_signature,
            'sha256_mismatches': hash_errors,
        },
        'source_manifest': str(manifest_path),
        'inventory_file': str(a.inventory),
        'sha256_list_file': str(a.sha256_list),
    }
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['counts'], ensure_ascii=False, sort_keys=True))
    if hash_errors or invalid_signature or missing_files:
        raise SystemExit('PDF acquisition report found integrity gaps; report was written for diagnosis.')


if __name__ == '__main__':
    main()
