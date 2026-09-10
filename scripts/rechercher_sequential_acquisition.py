#!/usr/bin/env python3
import argparse, json, os, re, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGES = [
    'Prophet era', 'Quran', 'Seerah', 'Companions', 'Followers',
    '1-400H', '401-800H', '801-1200H', '1201H', 'Modern era', 'Future books'
]

def text(v):
    return str(v or '').strip().casefold()

def classify(book, source_scope=''):
    fields = [
        text(book.get('target_scope')), text(book.get('scope')), text(book.get('era')),
        text(book.get('generation')), text(book.get('generation_type')), text(book.get('category')),
        text(book.get('type')), text(source_scope)
    ]
    blob = ' '.join(fields)
    if 'quran' in blob or 'قرآن' in blob or "qur'an" in blob:
        return 'Quran'
    if 'seerah' in blob or 'sira' in blob or 'سيرة' in blob or 'السيرة' in blob:
        return 'Seerah'
    if 'prophet era' in blob or 'prophet' in blob or 'نبوي' in blob or 'النبي' in blob:
        return 'Prophet era'
    if any(x in blob for x in ['companion', 'companions', 'sahabi', 'sahaba', 'صحابي', 'صحابة', 'الصحابة']):
        return 'Companions'
    if any(x in blob for x in ['follower', 'followers', 'tabi', "tabi'in", 'تابعي', 'تابعون', 'التابعون']):
        return 'Followers'
    death = book.get('author_death_hijri', book.get('deathYear'))
    try:
        death = int(death)
    except (TypeError, ValueError):
        death = None
    if death is not None:
        if death <= 400: return '1-400H'
        if death <= 800: return '401-800H'
        if death <= 1200: return '801-1200H'
        return '1201H'
    if any(x in blob for x in ['modern', 'contemporary', 'معاصر', 'حديث']):
        return 'Modern era'
    return 'Future books'

def load_catalog(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    books = data.get('books', []) if isinstance(data, dict) else []
    return data, books

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default=str(ROOT))
    args = ap.parse_args()
    root = Path(args.root).resolve()
    catalogs = sorted((root / 'books-batches').glob('**/catalog.json'))
    grouped = {stage: [] for stage in STAGES}
    seen = set()
    for path in catalogs:
        _, books = load_catalog(path)
        source_scope = str(path.relative_to(root))
        for book in books:
            if not isinstance(book, dict):
                continue
            key = str(book.get('id') or '').strip()
            if not key:
                key = 'title:' + re.sub(r'\s+', ' ', str(book.get('title') or book.get('titleAr') or '')).strip().casefold()
            if not key or key in seen:
                continue
            seen.add(key)
            grouped[classify(book, source_scope)].append(book)

    state_dir = root / 'artifacts' / 'governance' / 'sequential-acquisition'
    state_dir.mkdir(parents=True, exist_ok=True)
    state = {
        'schema': 'rechercher-central-sequential-era-engine/v1',
        'order': STAGES,
        'policy': 'single central engine; stages are ordered; failures are recorded and never stop later stages; reruns resume from existing verified PDFs',
        'unique_books': len(seen),
        'counts': {k: len(v) for k, v in grouped.items()},
        'completed': [],
        'failed_stages': [],
    }
    (state_dir / 'queue.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    original = root / 'scripts' / 'rechercher_waqfeya_acquire_original.py'
    if not original.is_file():
        raise SystemExit(f'missing central downloader: {original}')

    with tempfile.TemporaryDirectory(prefix='rechercher-sequential-') as td:
        temp = Path(td)
        (temp / 'books-batches').mkdir()
        (temp / 'scripts').symlink_to(root / 'scripts', target_is_directory=True)
        (temp / 'artifacts').symlink_to(root / 'artifacts', target_is_directory=True)
        for index, stage in enumerate(STAGES, 1):
            books = grouped[stage]
            stage_dir = temp / 'books-batches' / f'{index:02d}-{re.sub(r"[^a-z0-9]+", "-", stage.casefold()).strip("-")}'
            stage_dir.mkdir(parents=True, exist_ok=True)
            (stage_dir / 'catalog.json').write_text(json.dumps({'books': books}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            marker = state_dir / f'{index:02d}-{re.sub(r"[^a-z0-9]+", "-", stage.casefold()).strip("-")}.json'
            if not books:
                marker.write_text(json.dumps({'stage': stage, 'status': 'empty', 'books': 0}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                state['completed'].append(stage)
                (state_dir / 'queue.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
                continue
            print(f'\n===== STAGE {index}/{len(STAGES)}: {stage} | {len(books)} books =====', flush=True)
            env = os.environ.copy()
            env['RECHERCHER_ERA_STAGE'] = stage
            proc = subprocess.run(['python3', str(original), '--root', str(temp)], cwd=root, env=env)
            result = {'stage': stage, 'status': 'completed' if proc.returncode == 0 else 'failed', 'books': len(books), 'exit_code': proc.returncode}
            marker.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            if proc.returncode == 0:
                state['completed'].append(stage)
            else:
                state['failed_stages'].append(stage)
                print(f'[CONTINUE] stage failed but the central queue continues: {stage}', flush=True)
            (state_dir / 'queue.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    state['finished'] = True
    (state_dir / 'queue.json').write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('\n===== CENTRAL SEQUENTIAL ACQUISITION FINISHED =====', flush=True)
    print(json.dumps(state['counts'], ensure_ascii=False, sort_keys=True), flush=True)
    if state['failed_stages']:
        print('Failed stages are retained for the next scheduled/manual continuation:', ', '.join(state['failed_stages']), flush=True)

if __name__ == '__main__':
    main()
