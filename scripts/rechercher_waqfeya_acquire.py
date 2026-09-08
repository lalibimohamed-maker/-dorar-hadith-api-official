#!/usr/bin/env python3
import argparse, html, json, re, shutil, subprocess
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, quote
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser()
parser.add_argument('--root', default=None, help='repository worktree to mutate')
ARGS = parser.parse_args()
ROOT = Path(ARGS.root).resolve() if ARGS.root else Path(__file__).resolve().parents[1]
CATALOGS = sorted((ROOT / 'books-batches').glob('**/catalog.json')) if (ROOT / 'books-batches').exists() else []
ART = ROOT / 'artifacts'
ART.mkdir(exist_ok=True)
USER_AGENT = 'DinAllah-Encyclopedia/1.2'
DOWNLOAD_TIMEOUT = 120
MAX_SOURCE_ATTEMPTS = 12

def normalize_url(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe='/%:@-._~'), p.query, p.fragment))

def fetch(url):
    req = Request(normalize_url(url), headers={'User-Agent': USER_AGENT})
    with urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')

def pdf_links(page, base):
    out, seen = [], set()
    for m in re.finditer(r'href=["\']([^"\']+)["\']', page, re.I):
        u = normalize_url(urljoin(base, html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)', u, re.I) and u not in seen:
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
    if source.get('pdf_url'):
        return [normalize_url(source['pdf_url'])]
    page = source['url']
    if re.search(r'\.pdf(?:\?|$)', page, re.I):
        return [normalize_url(page)]
    # Fail over through every saved source page: a source does not need a
    # discover_pdfs flag for us to look for an actual PDF link. A source is
    # considered exhausted only after its page and all concrete PDF links fail.
    try:
        discovered = pdf_links(fetch(page), page)
    except Exception:
        discovered = []
    if discovered:
        return discovered
    return [normalize_url(page)]

def download(url, path):
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
            print(f'[FAILOVER] {book["id"]} volume {volume}: source {source_index}/{len(sources)} unavailable; trying next source')
            continue
        if source.get('volume') is not None and int(source['volume']) != volume:
            continue
        if source.get('volume_url_map'):
            mapped = source['volume_url_map'].get(str(volume)) or source['volume_url_map'].get(volume)
            urls = [mapped] if mapped else []
        elif source.get('discover_pdfs'):
            if len(urls) < expected:
                attempts.append({'source': source['url'], 'status': 'incomplete_source', 'found_pdfs': len(urls), 'expected': expected})
                print(f'[FAILOVER] {book["id"]} volume {volume}: source {source_index}/{len(sources)} has {len(urls)}/{expected} PDFs; trying next source')
                continue
            urls = [urls[volume - 1]]
        else:
            urls = urls[:MAX_SOURCE_ATTEMPTS]
        for url in urls[:MAX_SOURCE_ATTEMPTS]:
            candidate = work / f'{volume:03d}.candidate.pdf'
            try:
                print(f'Downloading {book["id"]} volume {volume}/{expected} from source {source_index}/{len(sources)}: {url}')
                download(url, candidate)
                if candidate.read_bytes()[:4] != b'%PDF':
                    attempts.append({'source': url, 'status': 'invalid_signature'}); candidate.unlink(missing_ok=True); continue
                validation = validate_and_repair(candidate)
                if validation['status'] in ('valid', 'repaired'):
                    final = work / f'{volume:03d}.pdf'; candidate.replace(final)
                    return final, {'volume': volume, 'url': url, 'source_label': source.get('label'), 'source_index': source_index, 'bytes': final.stat().st_size, 'sha256': sha256(final), 'validation': validation, 'attempts': attempts}
                attempts.append({'source': url, 'status': validation['status'], 'reason': validation.get('reason'), 'initial_check': validation.get('initial_check'), 'repair_check': validation.get('repair_check')})
            except Exception as exc:
                attempts.append({'source': url, 'status': 'download_or_validation_error', 'error': str(exc)})
            finally:
                candidate.unlink(missing_ok=True)
        print(f'[FAILOVER] {book["id"]} volume {volume}: source {source_index}/{len(sources)} exhausted; trying next source')
    return None, {'volume': volume, 'status': 'failed', 'attempts': attempts}

def acquire(book):
    if book.get('rights_status') != 'verified-redistributable':
        print(f"[HOLD] {book['id']}: rights not verified; metadata only")
        return {'id': book['id'], 'status': 'held-rights'}
    expected = int(book['expected_volumes'])
    safe = re.sub(r'[^a-z0-9._-]+', '-', book['id'].lower()).strip('-')
    work = ART / safe
    work.mkdir(parents=True, exist_ok=True)
    vols = []
    failed = []
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
        print(f"[RETRY] {book['id']}: {len(failed)} volume(s) failed across all saved sources; recorded for the next run")
        return {'id': book['id'], 'status': 'partial', 'failed_volumes': failed}
    unified = ART / f'{safe}.pdf'
    pages = [str(work / f'{n:03d}.pdf') for n in range(1, expected + 1)]
    run(['qpdf', '--empty', '--pages', *pages, '--', str(unified)])
    unified_validation = validate_and_repair(unified)
    if unified_validation['status'] not in ('valid', 'repaired'):
        print(f"[RETRY] {book['id']}: unified PDF failed validation")
        return {'id': book['id'], 'status': 'unified-validation-failed'}
    manifest = {'id': book['id'], 'title': book['title'], 'author': book['author'], 'edition': book.get('edition'), 'expected_volumes': expected, 'downloaded_volumes': len(vols), 'volumes': vols, 'unified_file': str(unified.relative_to(ROOT)), 'unified_bytes': unified.stat().st_size, 'unified_sha256': sha256(unified), 'unified_validation': unified_validation}
    (ART / f'{safe}.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'id': book['id'], 'status': 'acquired', 'manifest': str((ART / f'{safe}.manifest.json').relative_to(ROOT))}

summary = []
for catalog_path in CATALOGS:
    print(f'=== Processing catalog: {catalog_path.relative_to(ROOT)} ===')
    for book in json.loads(catalog_path.read_text(encoding='utf-8'))['books']:
        try:
            summary.append(acquire(book))
        except Exception as exc:
            print(f'[RETRY] {book.get("id")}: unexpected error: {exc}')
            summary.append({'id': book.get('id'), 'status': 'unexpected-error', 'error': str(exc)})

(ART / 'acquisition-run-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
