#!/usr/bin/env python3
import argparse, html, json, re, subprocess, os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, quote
from urllib.request import Request, urlopen

# Rechercher acquisition contract:
# - obtain a real .pdf first; never treat .pdf.enc as a PDF;
# - preserve acquired PDFs permanently and resume incomplete books;
# - rights/redistribution is reviewed AFTER acquisition, not used as an acquisition gate;
# - rights-unclear copies are retained as protected/private research material;
# - developer/private access is distinct from browser/public access;
# - rights-unclear copies are never browser-published or publicly downloadable;
# - never bypass access controls or protections: a source must lawfully provide the copy.

parser = argparse.ArgumentParser()
parser.add_argument('--root', default=None, help='repository worktree to mutate')
ARGS = parser.parse_args()
ROOT = Path(ARGS.root).resolve() if ARGS.root else Path(__file__).resolve().parents[1]
CATALOGS = sorted((ROOT / 'books-batches').glob('**/catalog.json')) if (ROOT / 'books-batches').exists() else []
ART = ROOT / 'artifacts'
ART.mkdir(exist_ok=True)
USER_AGENT = 'DinAllah-Encyclopedia/1.3'
DOWNLOAD_TIMEOUT = 120
MAX_SOURCE_ATTEMPTS = 12
MAX_BOOK_WORKERS = max(1, min(int(os.environ.get('RECHERCHER_MAX_BOOK_WORKERS', '12')), 32))

def redistribution_is_allowed(book):
    return book.get('redistribution_status') == 'verified-redistributable' or book.get('rights_status') == 'verified-redistributable'

def rights_state(book):
    if redistribution_is_allowed(book):
        return 'verified-redistributable'
    if book.get('rights_status') or book.get('redistribution_status') or book.get('acquisition_status'):
        return 'rights-review-required'
    return 'rights-unknown-protected-private'

def normalize_url(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe='/%:@-._~'), p.query, p.fragment))

def fetch(url):
    req = Request(normalize_url(url), headers={'User-Agent': USER_AGENT})
    with urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')

def pdf_links(page, base):
    out, seen = [], set()
    for m in re.finditer(r'href=[\"\']([^\"\']+)[\"\']', page, re.I):
        u = normalize_url(urljoin(base, html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)', u, re.I) and not re.search(r'\.pdf\.enc(?:\?|$)', u, re.I) and u not in seen:
            seen.add(u); out.append(u)
    return out

def qpdf_check(path):
    p = subprocess.run(['qpdf', '--check', str(path)], text=True, capture_output=True)
    return p.returncode, (p.stdout + p.stderr).strip()

def validate_and_repair(path):
    status, output = qpdf_check(path)
    if status == 0:
        return {'status': 'valid', 'repaired': False, 'initial_check': output, 'repair_check': None}
    if status == 2:
        return {'status': 'invalid', 'repaired': False, 'initial_check': output, 'repair_check': None, 'reason': 'qpdf_errors'}
    if status != 3:
        return {'status': 'invalid', 'repaired': False, 'initial_check': output, 'repair_check': None, 'reason': f'qpdf_exit_{status}'}
    original = path.with_name(path.name + '.pre-repair')
    try:
        path.rename(original)
        repair = subprocess.run(['qpdf', str(original), '--replace-input'], text=True, capture_output=True)
        if repair.returncode not in (0, 3):
            return {'status': 'invalid', 'repaired': False, 'initial_check': output, 'repair_check': (repair.stdout + repair.stderr).strip(), 'reason': f'repair_exit_{repair.returncode}'}
        status2, output2 = qpdf_check(original)
        if status2 == 0:
            original.rename(path)
            return {'status': 'repaired', 'repaired': True, 'initial_check': output, 'repair_check': output2}
        return {'status': 'invalid', 'repaired': False, 'initial_check': output, 'repair_check': output2, 'reason': f'post_repair_exit_{status2}'}
    finally:
        if not path.exists() and original.exists():
            original.rename(path)

def sha256(path):
    return subprocess.check_output(['sha256sum', str(path)], text=True).split()[0]

def run(cmd):
    return subprocess.run(cmd, check=True)

def source_candidates(book):
    candidates = []
    for source in book.get('sources', []):
        if isinstance(source, str):
            candidates.append({'url': source, 'label': 'catalogued-fallback'})
        elif isinstance(source, dict) and source.get('url'):
            candidates.append(dict(source))
    if book.get('waqfeya_url'):
        candidates.insert(0, {'url': book['waqfeya_url'], 'label': 'primary-waqfeya', 'discover_pdfs': True})
    unique, seen = [], set()
    for c in candidates:
        u = normalize_url(c['url'])
        if u not in seen:
            seen.add(u); c['url'] = u; unique.append(c)
    return unique

def candidate_urls(source):
    if source.get('pdf_url') and not re.search(r'\.pdf\.enc(?:\?|$)', source['pdf_url'], re.I):
        return [normalize_url(source['pdf_url'])]
    page = source['url']
    if re.search(r'\.pdf(?:\?|$)', page, re.I) and not re.search(r'\.pdf\.enc(?:\?|$)', page, re.I):
        return [normalize_url(page)]
    try:
        discovered = pdf_links(fetch(page), page)
    except Exception:
        discovered = []
    return discovered if discovered else [normalize_url(page)]

def download(url, path):
    if re.search(r'\.pdf\.enc(?:\?|$)', url, re.I):
        raise ValueError('encrypted .pdf.enc candidate rejected; Rechercher requires a real .pdf')
    subprocess.run(['curl', '-L', '--fail', '--retry', '5', '--retry-delay', '2', '--connect-timeout', '30', '--max-time', str(DOWNLOAD_TIMEOUT), '-o', str(path), url], check=True)

def acquire_volume(book, volume, expected, work):
    attempts = []
    sources = source_candidates(book)
    if not sources:
        return None, {'volume': volume, 'status': 'no_catalogued_source'}
    for source_index, source in enumerate(sources, 1):
        try:
            urls = candidate_urls(source)
        except Exception as exc:
            attempts.append({'source': source['url'], 'status': 'source_error', 'error': str(exc)})
            continue
        if source.get('volume') is not None and int(source['volume']) != volume:
            continue
        if source.get('volume_url_map'):
            mapped = source['volume_url_map'].get(str(volume)) or source['volume_url_map'].get(volume)
            urls = [mapped] if mapped else []
        elif source.get('discover_pdfs'):
            if len(urls) < expected:
                attempts.append({'source': source['url'], 'status': 'incomplete_source', 'found_pdfs': len(urls), 'expected': expected})
                continue
            urls = [urls[volume - 1]]
        else:
            urls = urls[:MAX_SOURCE_ATTEMPTS]
        for url in urls[:MAX_SOURCE_ATTEMPTS]:
            candidate = work / f'{volume:03d}.candidate.pdf'
            try:
                print(f'Downloading {book["id"]} volume {volume}/{expected} from source {source_index}/{len(sources)}: {url}', flush=True)
                download(url, candidate)
                if candidate.read_bytes()[:4] != b'%PDF':
                    attempts.append({'source': url, 'status': 'invalid_signature'}); candidate.unlink(missing_ok=True); continue
                validation = validate_and_repair(candidate)
                if validation['status'] in ('valid', 'repaired'):
                    final = work / f'{volume:03d}.pdf'; candidate.replace(final)
                    return final, {'volume': volume, 'url': url, 'source_label': source.get('label'), 'source_index': source_index, 'bytes': final.stat().st_size, 'sha256': sha256(final), 'validation': validation, 'attempts': attempts}
                attempts.append({'source': url, 'status': validation['status'], 'reason': validation.get('reason')})
            except Exception as exc:
                attempts.append({'source': url, 'status': 'download_or_validation_error', 'error': str(exc)})
            finally:
                candidate.unlink(missing_ok=True)
    return None, {'volume': volume, 'status': 'failed', 'attempts': attempts}

def acquire(book):
    # IMPORTANT: rights are NOT an acquisition gate. We first acquire and retain
    # the real PDF; rights review is recorded afterwards. Browser publication
    # remains independently blocked unless redistribution is verified.
    expected = int(book['expected_volumes'])
    safe = re.sub(r'[^a-z0-9._-]+', '-', book['id'].lower()).strip('-')
    work = ART / safe
    work.mkdir(parents=True, exist_ok=True)
    vols, failed = [], []
    for volume in range(1, expected + 1):
        final = work / f'{volume:03d}.pdf'
        if final.exists():
            vols.append({'volume': volume, 'status': 'already-present', 'bytes': final.stat().st_size, 'sha256': sha256(final)})
            continue
        _, record = acquire_volume(book, volume, expected, work)
        if record.get('status') in ('failed', 'no_catalogued_source'):
            failed.append(record)
        else:
            vols.append(record)
    if failed:
        (work / 'retry.json').write_text(json.dumps({'id': book['id'], 'failed_volumes': failed}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return {'id': book['id'], 'status': 'partial', 'failed_volumes': failed, 'rights_state': rights_state(book)}
    unified = ART / f'{safe}.pdf'
    pages = [str(work / f'{n:03d}.pdf') for n in range(1, expected + 1)]
    run(['qpdf', '--empty', '--pages', *pages, '--', str(unified)])
    unified_validation = validate_and_repair(unified)
    if unified_validation['status'] not in ('valid', 'repaired'):
        return {'id': book['id'], 'status': 'unified-validation-failed', 'rights_state': rights_state(book)}
    state = rights_state(book)
    redistributable = redistribution_is_allowed(book)
    manifest = {
        'id': book['id'], 'title': book['title'], 'author': book['author'], 'edition': book.get('edition'),
        'expected_volumes': expected, 'downloaded_volumes': len(vols), 'volumes': vols,
        'unified_file': str(unified.relative_to(ROOT)), 'unified_bytes': unified.stat().st_size,
        'unified_sha256': sha256(unified), 'unified_validation': unified_validation,
        'acquisition': 'acquired',
        'pdf': 'real+validated',
        'storage': 'permanent',
        'rights_review': state,
        'acquisition_basis_at_download': book.get('acquisition_status') or book.get('rights_status'),
        'public_browser': redistributable,
        'public_download': redistributable,
        'developer_private_access': True,
        'storage_visibility': 'private-protected' if not redistributable else 'publication-eligible',
        'browser_redistribution': redistributable,
        'browser_publication': 'allowed' if redistributable else 'blocked-protected-private'
    }
    (ART / f'{safe}.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'ACQUIRED {book["id"]}: retained real PDF; rights_review={state}; developer_private_access=true; public_browser={redistributable}', flush=True)
    return {'id': book['id'], 'status': 'acquired', 'manifest': str((ART / f'{safe}.manifest.json').relative_to(ROOT)), 'rights_state': state}

def load_books():
    books = {}
    for catalog_path in CATALOGS:
        print(f'=== Loading catalog: {catalog_path.relative_to(ROOT)} ===', flush=True)
        for book in json.loads(catalog_path.read_text(encoding='utf-8'))['books']:
            key = str(book.get('id') or '').strip()
            if key and key not in books:
                books[key] = book
    return list(books.values())

def main():
    books = load_books()
    print(f'=== Parallel PDF acquisition: {len(books)} unique books, {MAX_BOOK_WORKERS} workers ===', flush=True)
    summary = []
    with ThreadPoolExecutor(max_workers=MAX_BOOK_WORKERS, thread_name_prefix='rechercher-pdf') as pool:
        futures = {pool.submit(acquire, book): book for book in books}
        for future in as_completed(futures):
            book = futures[future]
            try:
                summary.append(future.result())
            except Exception as exc:
                print(f'[RETRY] {book.get("id")}: unexpected error: {exc}', flush=True)
                summary.append({'id': book.get('id'), 'status': 'unexpected-error', 'error': str(exc)})
    (ART / 'acquisition-run-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
