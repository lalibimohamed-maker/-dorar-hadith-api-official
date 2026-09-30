#!/usr/bin/env node
import fs from "node:fs";
import { mkdir, rm, stat, statfs, rename } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { once } from "node:events";

const HEX_SHA256=/^[a-f0-9]{64}$/i;

function safeChildPath(dir,name){
  if(typeof name!=="string" || !name || name.includes("\\") || path.isAbsolute(name)) {
    throw new Error("invalid manifest asset name: "+String(name));
  }
  const root=path.resolve(dir)+path.sep;
  const target=path.resolve(dir,name);
  if(!target.startsWith(root)) throw new Error("manifest path traversal rejected: "+name);
  return target;
}

export async function getFreeDiskBytes(targetPath){
  if (typeof statfs !== "function") throw new Error("DISK_SPACE_CHECK_UNAVAILABLE: fs.statfs is not available on this runtime");
  const info = await statfs(targetPath);
  if (!Number.isSafeInteger(info.bavail) || !Number.isSafeInteger(info.bsize) || info.bavail < 0 || info.bsize < 1) {
    throw new Error("DISK_SPACE_CHECK_INVALID: filesystem free-space data is invalid");
  }
  const freeBytes = info.bavail * info.bsize;
  if (!Number.isSafeInteger(freeBytes)) throw new Error("DISK_SPACE_CHECK_OVERFLOW: filesystem free-space value is unsafe");
  return freeBytes;
}

export function requiredPreflightBytes(totalSize, headroomRatio = 1.2){
  if (!Number.isSafeInteger(totalSize) || totalSize < 0) throw new Error("invalid total size for disk preflight");
  if (!Number.isFinite(headroomRatio) || headroomRatio < 1) throw new Error("invalid disk headroom ratio");
  const required = Math.ceil(totalSize * headroomRatio);
  if (!Number.isSafeInteger(required)) throw new Error("disk preflight size exceeds safe integer range");
  return required;
}

export async function assertDiskPreflight(targetPath, totalSize, {headroomRatio=1.2, getFreeBytes=getFreeDiskBytes}={}){
  const requiredBytes = requiredPreflightBytes(totalSize, headroomRatio);
  const freeBytes = await getFreeBytes(targetPath);
  if (!Number.isSafeInteger(freeBytes) || freeBytes < requiredBytes) {
    throw new Error("DISK_SPACE_PREFLIGHT_FAILED: required="+requiredBytes+" free="+String(freeBytes));
  }
  return Object.freeze({ok:true, free_bytes:freeBytes, required_bytes:requiredBytes, headroom_ratio:headroomRatio});
}

async function hashAndSize(filePath){
  const hash=createHash("sha256");
  const input=fs.createReadStream(filePath,{highWaterMark:1024*1024});
  let bytes=0;
  for await(const chunk of input){ hash.update(chunk); bytes+=chunk.length; }
  return {bytes,sha256:hash.digest("hex")};
}

export async function reassembleAndVerifyModel(
  manifestPath,
  inputDir,
  outputDir,
  {overwrite=false}={}
){
  const manifest=JSON.parse(await fs.promises.readFile(manifestPath,"utf8"));
  if(manifest?.format!=="dinullah/omega-sharded-file") throw new Error("unsupported sharded-file manifest");
  if(!HEX_SHA256.test(String(manifest.total_sha256??""))) throw new Error("manifest total_sha256 is invalid");
  if(!Number.isSafeInteger(manifest.total_size)||manifest.total_size<0) throw new Error("manifest total_size is invalid");
  if(!Number.isSafeInteger(manifest.chunk_size_bytes)||manifest.chunk_size_bytes<1) throw new Error("manifest chunk_size_bytes is invalid");
  if(!Array.isArray(manifest.chunks)||manifest.chunks.length<1) throw new Error("manifest chunks are missing");
  if(manifest.chunk_count!==manifest.chunks.length) throw new Error("manifest chunk_count mismatch");

  const targetDir=path.resolve(outputDir);
  await mkdir(targetDir,{recursive:true});
  const finalPath=safeChildPath(targetDir,manifest.model_name);
  const diskPreflight = await assertDiskPreflight(targetDir, manifest.total_size);
  if(!overwrite){
    try{await stat(finalPath);throw new Error("output already exists: "+finalPath);}catch(error){if(error?.code!=="ENOENT")throw error;}
  }

  const tempPath=finalPath+".assembling-"+process.pid+"-"+Date.now();
  const output=fs.createWriteStream(tempPath,{flags:"wx"});
  const globalHash=createHash("sha256");
  let totalWritten=0;

  try{
    for(let position=0;position<manifest.chunks.length;position++){
      const chunk=manifest.chunks[position];
      if(chunk.index!==position) throw new Error("manifest chunk index/order mismatch at "+position);
      if(typeof chunk.name!=="string") throw new Error("manifest chunk name missing at "+position);
      if(!Number.isSafeInteger(chunk.bytes)||chunk.bytes<0) throw new Error("manifest chunk size invalid at "+position);
      if(!HEX_SHA256.test(String(chunk.sha256??""))) throw new Error("manifest chunk sha256 invalid at "+position);
      if(chunk.bytes>manifest.chunk_size_bytes) throw new Error("manifest chunk exceeds declared chunk size at "+position);

      const chunkPath=safeChildPath(inputDir,chunk.name);
      const info=await stat(chunkPath);
      if(!info.isFile()) throw new Error("chunk is not a regular file: "+chunk.name);
      if(info.size!==chunk.bytes) throw new Error("chunk size mismatch: "+chunk.name);

      const hash=createHash("sha256");
      const input=fs.createReadStream(chunkPath,{highWaterMark:1024*1024});
      let chunkBytes=0;
      for await(const data of input){
        if(!output.write(data)) await once(output,"drain");
        hash.update(data);
        globalHash.update(data);
        chunkBytes+=data.length;
      }

      if(chunkBytes!==chunk.bytes) throw new Error("chunk read size mismatch: "+chunk.name);
      if(hash.digest("hex").toLowerCase()!==String(chunk.sha256).toLowerCase()){
        throw new Error("chunk SHA-256 mismatch: "+chunk.name);
      }
      totalWritten+=chunkBytes;
    }

    await new Promise((resolve,reject)=>{
      output.once("error",reject);
      output.end(resolve);
    });

    if(totalWritten!==manifest.total_size) throw new Error("assembled total size mismatch");
    const totalHash=globalHash.digest("hex");
    if(totalHash.toLowerCase()!==String(manifest.total_sha256).toLowerCase()){
      throw new Error("assembled total SHA-256 mismatch");
    }

    await rename(tempPath,finalPath);
    return {modelPath:finalPath,bytes:totalWritten,sha256:totalHash,chunk_count:manifest.chunk_count,disk_preflight:diskPreflight};
  }catch(error){
    output.destroy();
    await rm(tempPath,{force:true});
    throw error;
  }
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [, , manifest,inputDir,outputDir,...args]=process.argv;
  if(!manifest||!inputDir||!outputDir){
    console.error("usage: omega-file-reassembler.js <manifest> <input-dir> <output-dir> [--overwrite]");
    process.exit(2);
  }
  const result=await reassembleAndVerifyModel(manifest,inputDir,outputDir,{overwrite:args.includes("--overwrite")});
  console.log(JSON.stringify(result,null,2));
}
