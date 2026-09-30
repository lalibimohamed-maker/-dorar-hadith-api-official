import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sha256 as digest, shardModelFile } from "../scripts/omega-file-sharder.js";
import { reassembleAndVerifyModel } from "../scripts/omega-file-reassembler.js";
import { canonicalArabicText, arabicSkeleton, exactArabicEquivalent, classifyArabicMismatch } from "../src/rechercher-omega-arabic-integrity.js";
import { verifyEvidenceGate } from "../src/rechercher-omega-evidence-gate.js";

test("Arabic integrity preserves diacritics while accepting Unicode-compatible composition",()=>{
  const composed="إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ";
  const compatible="إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ".normalize("NFKD").normalize("NFC");
  assert.equal(exactArabicEquivalent(composed,compatible),true);
  assert.equal(arabicSkeleton(composed),arabicSkeleton("انما الاعمال بالنيات"));
  assert.equal(classifyArabicMismatch(composed,"إنما الأعمال بالنية"),"substantive-character-difference");
});

test("Evidence gate uses canonical Unicode equivalence but does not accept missing diacritics",()=>{
  const source="إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ";
  const decomposed=source.normalize("NFKD").normalize("NFC");
  const evidence=[{
    sourceId:"fixture",
    citation:"p1",
    kind:"primary_text",
    exact_quote_required:true,
    text:source,
    sha256:digest(source)
  }];
  const citations=[{sourceId:"fixture",citation:"p1",text_hash:digest(source)}];

  assert.equal(
    verifyEvidenceGate({answer:"النص: "+decomposed,evidence,citations}).ok,
    true
  );

  assert.throws(
    ()=>verifyEvidenceGate({answer:"النص: إنما الأعمال بالنيات",evidence,citations}),
    /STRICT_ALIGNMENT_MISMATCH/
  );
});

test("Streaming sharder produces deterministic chunk hashes and logical file hash",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"omega-shard-"));
  const input=path.join(root,"model.safetensors");
  const out=path.join(root,"parts");
  const source=Buffer.alloc(3*1024*1024+123,0x5a);
  await writeFile(input,source);

  try{
    const result=await shardModelFile(input,out,{chunkBytes:1024*1024,cleanOutput:true});
    assert.equal(result.manifest.total_size,source.length);
    assert.equal(result.manifest.total_sha256,digest(source));
    assert.equal(result.manifest.chunk_count,4);

    for(const chunk of result.manifest.chunks){
      const bytes=await readFile(path.join(out,chunk.name));
      assert.equal(bytes.length,chunk.bytes);
      assert.equal(digest(bytes),chunk.sha256);
    }
    assert.ok(result.manifest.chunks.every((chunk,index)=>chunk.index===index));
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("Reassembler verifies every chunk and the final logical model hash",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"omega-reassemble-"));
  const input=path.join(root,"parts");
  const assembled=path.join(root,"assembled");
  const model=path.join(root,"model.bin");
  const source=Buffer.from("دين الله|Rechercher Ω|UTF-8|deterministic".repeat(100000),"utf8");

  try{
    await writeFile(model,source);
    const sharded=await shardModelFile(model,input,{chunkBytes:4096,cleanOutput:true});
    await mkdir(assembled,{recursive:true});

    const result=await reassembleAndVerifyModel(sharded.manifestPath,input,assembled);
    assert.equal(result.bytes,source.length);
    assert.equal(result.sha256,digest(source));
    assert.deepEqual(await readFile(result.modelPath),source);

    const first=sharded.manifest.chunks[0];
    await writeFile(path.join(input,first.name),Buffer.from("corrupted"));
    await assert.rejects(
      ()=>reassembleAndVerifyModel(sharded.manifestPath,input,path.join(root,"bad")),
      /chunk (size mismatch|SHA-256 mismatch)/
    );
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test("Reassembler rejects manifest path traversal",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"omega-traversal-"));
  try{
    const input=path.join(root,"parts");
    const output=path.join(root,"out");
    await mkdir(input);
    const outside=path.join(root,"outside.bin");
    await writeFile(outside,Buffer.from("secret"));
    const manifest=path.join(root,"manifest.json");
    await writeFile(manifest,JSON.stringify({
      format:"dinullah/omega-sharded-file",
      model_name:"model.bin",
      total_size:6,
      total_sha256:digest("secret"),
      chunk_size_bytes:1024,
      chunk_count:1,
      chunks:[{index:0,name:"../outside.bin",bytes:6,sha256:digest("secret")}]
    }));
    await assert.rejects(
      ()=>reassembleAndVerifyModel(manifest,input,output),
      /path traversal rejected/
    );
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
