#!/usr/bin/env python3
"""Provider-neutral entry point for the central Rechercher PDF engine.

The legacy worker is loaded only as an implementation module. Source selection
is overridden here so no provider is privileged or treated as a mandatory gate.

Quality contract:
- never accept the first merely-valid PDF when alternative catalogued sources exist;
- validate every candidate that can be reached for the requested volume;
- score scan/text quality without changing the source PDF;
- retain only the highest-scoring candidate for each volume;
- keep losing candidates temporary and delete them immediately;
- if only one valid candidate exists, retain it even when its score is modest;
- quality selection is independent from rights/publication review.
"""
from __future__ import annotations
import importlib.util
import math
import os
import re
import shutil
import subprocess
from pathlib import Path

LEGACY=Path(__file__).with_name('rechercher_waqfeya_acquire_original.py')
spec=importlib.util.spec_from_file_location('rechercher_pdf_worker',LEGACY)
if spec is None or spec.loader is None: raise SystemExit(f'Cannot load central PDF worker: {LEGACY}')
worker=importlib.util.module_from_spec(spec); spec.loader.exec_module(worker)

def provider_neutral_sources(book):
    candidates=[]
    for source in book.get('sources',[]):
        if isinstance(source,str): candidates.append({'url':source,'label':'catalogued-source','discover_pdfs':True})
        elif isinstance(source,dict) and source.get('url'): candidates.append(dict(source))
    for key in ('source_url','url'):
        if book.get(key): candidates.append({'url':book[key],'label':key,'discover_pdfs':True})
    unique=[];seen=set()
    for candidate in candidates:
        url=worker.normalize_url(candidate['url'])
        if url not in seen: seen.add(url); candidate['url']=url; unique.append(candidate)
    return unique

worker.source_candidates=provider_neutral_sources
worker.MAX_SOURCE_ATTEMPTS=max(12,int(os.environ.get('RECHERCHER_MAX_SOURCE_ATTEMPTS','24')))


def _run_text(cmd):
    try:
        p=subprocess.run(cmd,text=True,capture_output=True,check=False)
        return p.returncode,p.stdout,p.stderr
    except Exception:
        return 127,'',''


def quality_score(path):
    """Return a deterministic, non-destructive PDF quality score (0..100)."""
    size=path.stat().st_size
    pages=0
    rc,out,_=_run_text(['pdfinfo',str(path)])
    if rc==0:
        m=re.search(r'^Pages:\s*(\d+)',out,re.M)
        if m: pages=int(m.group(1))

    # Text layer is useful, but it must never outweigh scan readability.
    text_chars=0
    rc,out,_=_run_text(['pdftotext','-f','1','-l',str(max(1,pages or 1)),str(path),'-'])
    if rc==0:
        text_chars=len(re.sub(r'\s+','',out))
    chars_per_page=text_chars/max(1,pages)
    text_score=min(100.0, chars_per_page/8.0) if text_chars else 0.0

    # For scanned books, image resolution is the main quality signal.
    dpi=[]
    rc,out,_=_run_text(['pdfimages','-list',str(path)])
    if rc==0:
        for line in out.splitlines():
            s=line.strip()
            if not s or not re.match(r'^\d+\s+\d+\s+',s): continue
            cols=s.split()
            # pdfimages columns: page num type width height color comp bpc enc interp object ID x-ppi y-ppi size ratio
            if len(cols)>=13:
                for idx in (11,12):
                    try:
                        v=float(cols[idx])
                        if 10 <= v <= 2400: dpi.append(v)
                    except ValueError: pass
    if dpi:
        median=sorted(dpi)[len(dpi)//2]
        if median < 75: dpi_score=20.0*median/75.0
        elif median < 150: dpi_score=20.0+40.0*(median-75)/75.0
        elif median < 300: dpi_score=60.0+35.0*(median-150)/150.0
        else: dpi_score=95.0+5.0*min(1.0,(median-300)/300.0)
    else:
        dpi_score=35.0 if text_chars else 15.0

    # Size is only a weak signal: larger is not automatically better.
    size_mb=size/(1024*1024)
    size_score=min(100.0, 35.0 + 12.0*math.log1p(max(0.0,size_mb)))

    # More pages generally indicates completeness when comparing candidates for the same volume.
    page_score=min(100.0, pages/800.0*100.0) if pages else 0.0
    score=0.50*dpi_score + 0.20*text_score + 0.15*page_score + 0.15*size_score
    return {
        'score':round(score,3), 'pages':pages, 'bytes':size,
        'size_mb':round(size_mb,3), 'text_chars':text_chars,
        'chars_per_page':round(chars_per_page,2),
        'median_image_dpi':round(sorted(dpi)[len(dpi)//2],2) if dpi else None,
        'quality_basis':'dpi>text-layer>page-completeness>weak-size-signal'
    }


def acquire_volume_quality(book, volume, expected, work):
    attempts=[]
    sources=provider_neutral_sources(book)
    if not sources:
        return None, {'volume':volume,'status':'no_catalogued_source'}
    best=None
    candidate_paths=[]
    try:
        for source_index,source in enumerate(sources,1):
            try: urls=worker.candidate_urls(source)
            except Exception as exc:
                attempts.append({'source':source.get('url'),'status':'source_error','error':str(exc)}); continue
            if source.get('volume') is not None and int(source['volume']) != volume: continue
            if source.get('volume_url_map'):
                mapped=source['volume_url_map'].get(str(volume)) or source['volume_url_map'].get(volume)
                urls=[mapped] if mapped else []
            elif source.get('discover_pdfs'):
                if len(urls)<expected:
                    attempts.append({'source':source['url'],'status':'incomplete_source','found_pdfs':len(urls),'expected':expected}); continue
                urls=[urls[volume-1]]
            else:
                urls=urls[:worker.MAX_SOURCE_ATTEMPTS]
            for url_index,url in enumerate(urls[:worker.MAX_SOURCE_ATTEMPTS],1):
                candidate=work/f'{volume:03d}.candidate-{source_index}-{url_index}.pdf'
                try:
                    if re.search(r'\.pdf\.enc(?:\?|$)',url,re.I):
                        attempts.append({'source':url,'status':'encrypted_rejected'}); continue
                    print(f'Quality candidate {book["id"]} volume {volume}/{expected} source {source_index}/{len(sources)}: {url}',flush=True)
                    worker.download(url,candidate)
                    if candidate.read_bytes()[:4] != b'%PDF':
                        attempts.append({'source':url,'status':'invalid_signature'}); continue
                    validation=worker.validate_and_repair(candidate)
                    if validation['status'] not in ('valid','repaired'):
                        attempts.append({'source':url,'status':'invalid_pdf','reason':validation.get('reason')}); continue
                    q=quality_score(candidate)
                    rec={'source':url,'source_label':source.get('label'),'source_index':source_index,'url_index':url_index,'validation':validation,'quality':q}
                    attempts.append({'source':url,'status':'valid_candidate','quality':q})
                    if best is None or (q['score'],q.get('median_image_dpi') or 0,q['pages'],q['bytes']) > (best['quality']['score'],best['quality'].get('median_image_dpi') or 0,best['quality']['pages'],best['quality']['bytes']):
                        if best is not None: Path(best['path']).unlink(missing_ok=True)
                        best={**rec,'path':str(candidate)}
                    else:
                        candidate.unlink(missing_ok=True)
                except Exception as exc:
                    attempts.append({'source':url,'status':'download_or_quality_error','error':str(exc)})
                    candidate.unlink(missing_ok=True)
        if best is None:
            return None, {'volume':volume,'status':'failed','attempts':attempts}
        final=work/f'{volume:03d}.pdf'
        Path(best['path']).replace(final)
        return final, {
            'volume':volume,'status':'selected-best-quality','url':best['source'],
            'source_label':best.get('source_label'),'source_index':best.get('source_index'),
            'bytes':final.stat().st_size,'sha256':worker.sha256(final),
            'validation':best['validation'],'quality':best['quality'],
            'candidate_count':sum(1 for a in attempts if a.get('status')=='valid_candidate'),
            'attempts':attempts
        }
    finally:
        for p in work.glob(f'{volume:03d}.candidate-*.pdf'):
            p.unlink(missing_ok=True)

worker.acquire_volume=acquire_volume_quality

if __name__=='__main__': worker.main()
