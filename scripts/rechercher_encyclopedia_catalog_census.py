#!/usr/bin/env python3
"""Build a conservative whole-encyclopedia book census from saved catalogs.

The central master catalog is materialized first so supplementary indexes such
as Dorar see the same 247-book acquisition universe as Rechercher itself.
This layer remains discovery-only: it never grants rights or downloads files.
"""
import json
import re
import subprocess
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / 'config' / 'rechercher-encyclopedia-catalog-registry.json'
MASTER = ROOT / 'books-batches' / 'encyclopedia-master' / 'catalog.json'
OUT = ROOT / 'artifacts' / 'governance' / 'encyclopedia-master-catalog-census.json'


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def ensure_master_materialized():
    """Make the central catalog authoritative before any census/matching step."""
    builder = ROOT / 'scripts' / 'rechercher_materialize_master_catalog.py'
    governed = ROOT / '.governance-source' / 'scripts' / 'rechercher_materialize_master_catalog.py'
    if not builder.exists() and governed.exists():
        builder.parent.mkdir(parents=True, exist_ok=True)
        builder.write_text(governed.read_text(encoding='utf-8'), encoding='utf-8')
    if builder.exists():
        current = {}
        if MASTER.exists():
            try:
                current = load_json(MASTER)
            except Exception:
                current = {}
        if not isinstance(current.get('books'), list) or not current.get('books'):
            subprocess.run(['python3', str(builder)], cwd=ROOT, check=True)


def safe_text(v):
    return str(v or '').strip()


def normalize(v):
    return re.sub(r'\s+', ' ', safe_text(v).casefold()).strip()


def add(rows, *, source, target_scope, item, item_kind='book'):
    if not isinstance(item, dict):
        return
    title = safe_text(item.get('title') or item.get('titleAr') or item.get('name') or item.get('nameAr'))
    author = safe_text(item.get('author') or item.get('authorAr') or item.get('authorName') or item.get('nameAr'))
    if not title:
        return
    key = safe_text(item.get('id')) or f"title:{normalize(title)}|author:{normalize(author)}"
    rows.append({
        'key': key,
        'title': title,
        'author': author or None,
        'source': source,
        'target_scope': target_scope,
        'item_kind': item_kind,
        'author_death_hijri': item.get('author_death_hijri') or item.get('deathYear'),
        'edition': item.get('edition'),
        'rights_status': item.get('rights_status') or item.get('rights'),
        'source_refs': item.get('sources') or item.get('sourceIds'),
    })


def extract_source(path, scope_hint):
    payload = load_json(path)
    rows = []
    if isinstance(payload, dict) and isinstance(payload.get('books'), list):
        author_map = {}
        for a in payload.get('authors', []) or []:
            if isinstance(a, dict):
                aid = safe_text(a.get('id'))
                if aid:
                    author_map[aid] = a
        for book in payload['books']:
            b = dict(book) if isinstance(book, dict) else {}
            aid = safe_text(b.get('authorId'))
            if aid and aid in author_map:
                a = author_map[aid]
                b.setdefault('author', a.get('name') or a.get('nameAr'))
                b.setdefault('deathYear', a.get('deathYear'))
                b.setdefault('era', a.get('era'))
            add(rows, source=str(path.relative_to(ROOT)), target_scope=scope_hint, item=b)
    if isinstance(payload, dict) and isinstance(payload.get('sourceWorks'), list):
        for work in payload['sourceWorks']:
            add(rows, source=str(path.relative_to(ROOT)), target_scope='Prophet era / Seerah', item=work, item_kind='sourceWork')
    if isinstance(payload, dict) and isinstance(payload.get('authors'), list):
        for author in payload['authors']:
            if not isinstance(author, dict):
                continue
            author_name = author.get('name') or author.get('nameAr')
            for work in author.get('works', []) or []:
                w = dict(work) if isinstance(work, dict) else {}
                w.setdefault('author', author_name)
                add(rows, source=str(path.relative_to(ROOT)), target_scope=scope_hint, item=w, item_kind='authorWork')
    return rows


def iter_source_paths():
    seen = set()
    for p in sorted((ROOT / 'books-batches').glob('**/catalog.json')):
        seen.add(p.resolve())
        yield p, 'catalogued book batch'
    registry = load_json(REGISTRY)
    for era in registry.get('eras', []):
        scope = era.get('label', era.get('id', 'unknown'))
        for source in era.get('sources', []):
            if '*' in source:
                for p in sorted(ROOT.glob(source)):
                    if p.is_file() and p.resolve() not in seen:
                        seen.add(p.resolve())
                        yield p, scope
            else:
                p = ROOT / source
                if p.is_file() and p.resolve() not in seen:
                    seen.add(p.resolve())
                    yield p, scope


def classify(row):
    death = row.get('author_death_hijri')
    try:
        death = int(death)
    except (TypeError, ValueError):
        death = None
    if death is not None:
        if death <= 400:
            return '1-400H'
        if death <= 800:
            return '401-800H'
        if death <= 1200:
            return '801-1200H'
        return '1201H+'
    scope = row.get('target_scope', '')
    if 'Prophet era' in scope:
        return 'Prophet era / Seerah'
    if 'Modern' in scope or 'modern' in scope:
        return 'Modern era'
    return 'UNCLASSIFIED-ERA'


def main():
    ensure_master_materialized()
    all_rows = []
    errors = []
    for path, scope in iter_source_paths():
        try:
            all_rows.extend(extract_source(path, scope))
        except Exception as exc:
            errors.append({'source': str(path.relative_to(ROOT)), 'error': str(exc)})

    dedup = {}
    for row in all_rows:
        key = row['key']
        current = dedup.get(key)
        if current is None:
            dedup[key] = row
        else:
            refs = set(current.get('source_refs') or [])
            refs.update(row.get('source_refs') or [])
            current['source_refs'] = sorted(str(x) for x in refs if x)
            current['sources'] = sorted(set(current.get('sources', [current['source']])) | {row['source']})

    books = []
    counts = defaultdict(int)
    for row in dedup.values():
        era = classify(row)
        row['classified_era'] = era
        row.setdefault('sources', [row['source']])
        counts[era] += 1
        books.append(row)

    books.sort(key=lambda r: (r['classified_era'], r['author_death_hijri'] or 99999, normalize(r['title'])))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    report = {
        'schema': 'rechercher-encyclopedia-master-catalog-census/v1',
        'purpose': 'Conservative census of the materialized central catalog plus governed saved source catalogs.',
        'registry': str(REGISTRY.relative_to(ROOT)),
        'master_catalog': str(MASTER.relative_to(ROOT)),
        'source_patterns': ['books-batches/**/catalog.json'],
        'book_count_unique': len(books),
        'counts_by_era': dict(sorted(counts.items())),
        'errors': errors,
        'policy': {
            'discovery_only': True,
            'rights_inferred': False,
            'pdf_downloaded': False,
            'future_additions': 'any newly saved governed catalog/source is eligible for the next census'
        },
        'books': books,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'[CENSUS] unique catalog records: {len(books)}', flush=True)
    for era, count in sorted(counts.items()):
        print(f'[CENSUS] {era}: {count}', flush=True)
    print(f'[CENSUS] source parse errors: {len(errors)}', flush=True)


if __name__ == '__main__':
    main()
