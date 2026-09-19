#!/usr/bin/env python3
import json, os, re, subprocess, sys, time
from pathlib import Path

REPO = os.environ["GH_REPO"]
OUT = Path(os.environ.get("SELF_HEAL_REPORT", "self-heal-report.json"))
MAX_PRS = int(os.environ.get("MAX_PRS", "200"))

def gh_api(path, method="GET", data=None):
    cmd=["gh","api",path]
    if method != "GET":
        cmd += ["--method",method]
    if data:
        for k,v in data.items():
            cmd += ["-f",f"{k}={v}"]
    p=subprocess.run(cmd,text=True,capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.strip() or p.stdout.strip())
    return json.loads(p.stdout) if p.stdout.strip() else {}

def gh_retry_failed(run_id):
    p=subprocess.run(["gh","run","rerun",str(run_id),"--failed","-R",REPO],text=True,capture_output=True)
    return p.returncode == 0, (p.stdout+p.stderr).strip()

def classify(log):
    s=log.lower()
    if any(x in s for x in ["429 too many requests","rate limit","timed out","connection reset","connection refused","502 bad gateway","503 service unavailable","504 gateway"]):
        return "transient-external"
    if "permission denied" in s or "resource not accessible by integration" in s:
        return "permission-external"
    if any(x in s for x in ["actionlint","unpinned","mutable tag","persist-credentials","upload-artifact@","checkout@"]):
        return "workflow-policy"
    if "unsupported engine" in s or "node.js version" in s or "node version" in s:
        return "runtime-version"
    if "ubuntu" in s and any(x in s for x in ["package not found","apt-get","deprecated"]):
        return "runner-environment"
    if "test 22" in s or "test 24" in s:
        return "test-failure"
    return "code-or-domain"

def main():
    prs=gh_api(f"/repos/{REPO}/pulls?state=open&per_page=100")
    prs=(prs or [])[:MAX_PRS]
    records=[]
    for pr in prs:
        sha=pr["head"]["sha"]; branch=pr["head"]["ref"]; number=pr["number"]
        checks=gh_api(f"/repos/{REPO}/commits/{sha}/check-runs?per_page=100").get("check_runs",[])
        failed=[c for c in checks if c.get("status")=="completed" and c.get("conclusion") in {"failure","timed_out","cancelled","action_required","startup_failure"}]
        active=[c for c in checks if c.get("status")!="completed"]
        rec={"pr":number,"branch":branch,"sha":sha,"base":pr["base"]["ref"],"failed":[],"active":[c["name"] for c in active],"actions":[]}
        for c in failed:
            item={"check":c["name"],"conclusion":c.get("conclusion"),"url":c.get("html_url")}
            # Check-run logs are exposed through the associated job URL when available.
            item["classification"]="unknown"
            rec["failed"].append(item)
        # Only retry failures that are plausibly transient; never blindly rerun deterministic test failures.
        for c in failed:
            url=c.get("details_url") or c.get("html_url") or ""
            m=re.search(r"/runs/(\d+)",url)
            if m and rec["failed"][-1]["classification"]=="transient-external":
                ok,msg=gh_retry_failed(m.group(1))
                rec["actions"].append({"run":m.group(1),"action":"rerun-failed-jobs","ok":ok,"message":msg[-500:]})
        records.append(rec)
    OUT.write_text(json.dumps({"generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"repository":REPO,"pull_requests":records},ensure_ascii=False,indent=2))
    print(json.dumps({"pull_requests":len(records),"failed_checks":sum(len(r["failed"]) for r in records),"active_checks":sum(len(r["active"]) for r in records),"report":str(OUT)},ensure_ascii=False))

if __name__=="__main__":
    main()
