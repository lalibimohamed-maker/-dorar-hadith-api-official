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
USER_AGENT = 'DinAllah-Encyclopedia/1.1'
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
    return pdf_links(fetch(page), page) if source.get('discover_pdfs') else [normalize_url(page)]

def download(url, path):
    subprocess.run(['curl', '-L', '--fail', '--retry', '5', '--retry-delay', '2', '--connect-timeout', '30', '--max-time', str(DOWNLOAD_TIMEOUT), '-o', str(path), url], check=True)

def acquire_volume(book, volume, expected, work):
    attempts = []
    sources = source_candidates(book)
    if not sources:
        raise SystemExit(f"{book['id']} volume {volume}: no catalogued source exists")
    for source in sources:
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
            urls = urls[:1]
        for url in urls[:MAX_SOURCE_ATTEMPTS]:
            candidate = work / f'{volume:03d}.candidate.pdf'
            try:
                print(f'Downloading {book["id"]} volume {volume}/{expected} from {url}')
                download(url, candidate)
                if candidate.read_bytes()[:4] != b'%PDF':
                    attempts.append({'source': url, 'status': 'invalid_signature'}); candidate.unlink(missing_ok=True); continue
                validation = validate_and_repair(candidate)
                if validation['status'] in ('valid', 'repaired'):
                    final = work / f'{volume:03d}.pdf'; candidate.replace(final)
                    return final, {'volume': volume, 'url': url, 'source_label': source.get('label'), 'bytes': final.stat().st_size, 'sha256': sha256(final), 'validation': validation, 'attempts': attempts}
                attempts.append({'source': url, 'status': validation['status'], 'reason': validation.get('reason'), 'initial_check': validation.get('initial_check'), 'repair_check': validation.get('repair_check')})
            except Exception as exc:
                attempts.append({'source': url, 'status': 'download_or_validation_error', 'error': str(exc)})
            finally:
                candidate.unlink(missing_ok=True)
    raise SystemExit(f"{book['id']} volume {volume}: all catalogued sources failed; no unverified/different edition was accepted.\n" + json.dumps(attempts, ensure_ascii=False, indent=2))

def acquire(book):
    if book.get('rights_status') != 'verified-redistributable':
        print(f"[HOLD] {book['id']}: rights not verified; metadata only"); return
    expected = int(book['expected_volumes'])
    safe = re.sub(r'[^a-z0-9._-]+', '-', book['id'].lower()).strip('-')
    work = ART / safe
    if work.exists(): shutil.rmtree(work)
    work.mkdir(parents=True, exist_ok=True)
    vols = []
    for volume in range(1, expected + 1):
        _, record = acquire_volume(book, volume, expected, work); vols.append(record)
    if len(vols) != expected or [v['volume'] for v in vols] != list(range(1, expected + 1)):
        raise SystemExit(f"{book['id']}: completeness gate failed; refusing to unify incomplete volumes")
    unified = ART / f'{safe}.pdf'
    pages = [str(work / f'{n:03d}.pdf') for n in range(1, expected + 1)]
    run(['qpdf', '--empty', '--pages', *pages, '--', str(unified)])
    unified_validation = validate_and_repair(unified)
    if unified_validation['status'] not in ('valid', 'repaired'):
        raise SystemExit(f"{book['id']}: unified PDF failed validation")
    manifest = {'id': book['id'], 'title': book['title'], 'author': book['author'], 'edition': book.get('edition'), 'expected_volumes': expected, 'downloaded_volumes': len(vols), 'volumes': vols, 'unified_file': str(unified.relative_to(ROOT)), 'unified_bytes': unified.stat().st_size, 'unified_sha256': sha256(unified), 'unified_validation': unified_validation, 'ingest_policy': 'primary source -> strict PDF validation -> qpdf repair for warnings -> strict recheck -> catalogued same-edition fallback sources -> per-volume SHA-256 -> complete ordered unification -> strict unified validation; reject only after all matching catalogued sources fail', 'fallback_policy': 'Never substitute a different edition merely because the title matches; fallback sources must be edition-scoped.'}
    (ART / f'{safe}.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

for catalog_path in CATALOGS:
    print(f'=== Processing catalog: {catalog_path.relative_to(ROOT)} ===')
    for book in json.loads(catalog_path.read_text(encoding='utf-8'))['books']:
        acquire(book)
