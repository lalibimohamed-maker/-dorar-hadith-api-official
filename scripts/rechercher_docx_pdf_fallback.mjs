#!/usr/bin/env node
import fs from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const execFileAsync=promisify(execFile);

export async function validateRepairAndQualityGate(pdfPath){
  const check=async()=>{try{await execFileAsync("qpdf",["--check",pdfPath]);return 0;}catch(e){return Number.isInteger(e?.code)?e.code:1;}};
  let rc=await check();
  if(rc!==0){
    try{await execFileAsync("qpdf",[pdfPath,"--replace-input"]);}catch{}
    rc=await check();
  }
  if(rc!==0) throw new Error("PDF failed qpdf validation after repair attempt");
  await execFileAsync("python3",["-c",[
    "from pathlib import Path",
    "from scripts.rechercher_pdf_quality_gate import inspect",
    "import sys",
    "r=inspect(Path(sys.argv[1]))",
    "print(r)",
    "raise SystemExit(0 if r.get('status')=='pass' else 1)"
  ].join(";"),pdfPath]);
  const head=Buffer.alloc(5);
  const fh=await fs.open(pdfPath,"r");
  let st;
  try{
    st=await fh.stat();
    await fh.read(head,0,5,0);
  }finally{
    await fh.close();
  }
  if(st.size<=0||head.toString()!=="%PDF-") throw new Error("quality-gated PDF is empty or invalid");
  return {bytes:st.size};
}
