#!/usr/bin/env python3
"""Append a minimal audit event as NDJSON. Secrets must never be passed here."""
import argparse
import datetime
import json
from pathlib import Path

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--log', default='artifacts/governance/audit.ndjson')
    ap.add_argument('--who', required=True)
    ap.add_argument('--what', required=True)
    ap.add_argument('--source', required=True)
    ap.add_argument('--reason', required=True)
    ap.add_argument('--commit', default='')
    ap.add_argument('--hash', dest='hash_value', default='')
    a = ap.parse_args()
    event = {
        'who': a.who,
        'what': a.what,
        'when': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source': a.source,
        'old_value': None,
        'new_value': None,
        'reason': a.reason,
        'commit': a.commit,
        'hash': a.hash_value,
    }
    p = Path(a.log)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open('a', encoding='utf-8') as f:
        f.write(json.dumps(event, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'logged': True}, ensure_ascii=False))

if __name__ == '__main__':
    main()
