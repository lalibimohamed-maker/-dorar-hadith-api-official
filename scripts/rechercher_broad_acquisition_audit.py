#!/usr/bin/env python3
import argparse, hashlib, html, json, re, shutil, subprocess, tempfile
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit, quote
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser()
parser.add_argument('--root', required=True)
parser.add_argument('--catalog', default='books-batches/salaf-01-400h/catalog.json')
parser.add_argument('--out', default='books-batches/salaf-01-400h/broad-acquisition-audit.json')
ARGS = parser.parse_args()
ROOT = Path(ARGS.root).resolve()
CATALOG = ROOT / ARGS.catalog
OUT = ROOT / ARGS.out
UA = 'DinAllah-Encyclopedia/1.2 broad-acquisition-audit'
TIMEOUT = 90
MAX_ATTEMPTS = 12


def normalize_url(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path, safe='/%:@-._~'), p.query, p.fragment))


def fetch_text(url):
    req = Request(normalize_url(url), headers={'User-Agent': UA})
    with urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode('utf-8', 'replace')


def pdf_links(page, base):
    out, seen = [], set()
    for m in re.finditer(r'href=["\']([^"\']+)["\']', page, re.I):
        u = normalize_url(urljoin(base, html.unescape(m.group(1))))
        if re.search(r'\.pdf(?:\?|$)', u, re.I) and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def source_candidates(book):
    out = []
    if book.get('waqfeya_url'):
        out.append({'url': book['waqfeya_url'], 'label': 'waqfeya', 'discover_pdfs': True})
    for src in book.get('sources', []):
        if isinstance(src, str):
            out.append({'url': src, 'label': 'catalogued-source'})
        elif isinstance(src, dict) and src.get('url'):
            out.append(dict(src))
    seen, unique = set(), []
    for src in out:
        src['url'] = normalize_url(src['url'])
        if src['url'] not in seen:
            seen.add(src['url'])
            unique.append(src)
    return unique


def urls_for_source(src):
    if src.get('pdf_url'):
        return [normalize_url(src['pdf_url'])]
    if src.get('discover_pdfs'):
        return pdf_links(fetch_text(src['url']), src['url'])
    return [src['url']]


def download(url, path):
    subprocess.run(['curl', '-L', '--fail', '--retry', '3', '--retry-delay', '2', '--connect-timeout', '20', '--max-time', str(TIMEOUT), '-o', str(path), url], check=True)


def validate(path):
    result = subprocess.run(['qpdf', '--check', str(path)], text=True, capture_output=True)
    return {'ok': result.returncode == 0, 'exit_code': result.returncode, 'output': (result.stdout + result.stderr).strip()}


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def audit_book(book, tmp):
    result = {
        'id': book['id'],
        'title': book['title'],
        'author': book.get('author'),
        'author_death_hijri': book.get('author_death_hijri'),
        'edition': book.get('edition'),
        'catalog_rights_status': book.get('rights_status'),
        'acquisition': 'persistent' if book.get('rights_status') == 'verified-redistributable' else 'ephemeral-probe',
        'candidates': [],
    }
    for src in source_candidates(book):
        try:
            urls = urls_for_source(src)
        except Exception as exc:
            result['candidates'].append({'source': src['url'], 'status': 'source_error', 'error': str(exc)})
            continue
        for url in urls[:MAX_ATTEMPTS]:
            p = tmp / (hashlib.sha256(url.encode()).hexdigest() + '.pdf')
            rec = {'source': src['url'], 'url': url, 'source_label': src.get('label')}
            try:
                download(url, p)
                data = p.read_bytes()
                if data[:4] != b'%PDF':
                    rec['status'] = 'not_pdf'
                else:
                    rec['bytes'] = len(data)
                    rec['sha256'] = sha256(p)
                    rec['validation'] = validate(p)
                    rec['status'] = 'valid_pdf' if rec['validation']['ok'] else 'invalid_pdf'
            except Exception as exc:
                rec['status'] = 'download_error'
                rec['error'] = str(exc)
            finally:
                p.unlink(missing_ok=True)
            result['candidates'].append(rec)
            if rec['status'] == 'valid_pdf':
                if book.get('rights_status') == 'verified-redistributable':
                    result['persistent_candidate'] = rec
                else:
                    result['redistribution'] = 'held-pending-rights'
                return result
    result['redistribution'] = 'held-pending-rights' if book.get('rights_status') != 'verified-redistributable' else 'no-valid-candidate'
    return result


def main():
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    tmp = Path(tempfile.mkdtemp(prefix='salaf-broad-acquisition-'))
    try:
        records = [audit_book(book, tmp) for book in catalog['books']]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    summary = {
        'schema': 'salaf-broad-acquisition-audit/v1',
        'scope': catalog['scope'],
        'principle': 'probe and record broadly; persist only when redistribution status is verified; uncertain copies are validated and hashed transiently then removed',
        'source_assumption': 'A hosted/downloadable file is evidence of availability, not by itself proof of redistribution permission.',
        'records': records,
        'counts': {
            'books': len(records),
            'valid_candidates': sum(any(c.get('status') == 'valid_pdf' for c in r['candidates']) for r in records),
            'persistent_candidates': sum('persistent_candidate' in r for r in records),
            'rights_held': sum(r.get('redistribution') == 'held-pending-rights' for r in records),
            'no_valid_candidate': sum(r.get('redistribution') == 'no-valid-candidate' for r in records),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()
