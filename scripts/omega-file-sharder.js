#!/usr/bin/env node
import fs from "node:fs";
import { mkdir, rm, stat, open } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const DEFAULT_CHUNK_BYTES = 1900 * 1024 * 1024;
export const MAX_GITHUB_RELEASE_ASSET_BYTES = 2147483647;

function parsePositiveInteger(value,name){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1) throw new RangeError(name+" must be a positive integer");
  return n;
}

function chunkName(fileName,index,width){
  return fileName+".part-"+String(index).padStart(width,"0");
}

async function hashFile(filePath){
  const hash=createHash("sha256");
  const input=fs.createReadStream(filePath,{highWaterMark:1024*1024});
  let bytes=0;
  for await(const chunk of input){ hash.update(chunk); bytes+=chunk.length; }
  return {sha256:hash.digest("hex"),bytes};
}

export async function shardModelFile(
  filePath,
  outputDir,
  {chunkBytes=DEFAULT_CHUNK_BYTES,cleanOutput=false}={}
){
  chunkBytes=parsePositiveInteger(chunkBytes,"chunkBytes");
  if(chunkBytes>=MAX_GITHUB_RELEASE_ASSET_BYTES) {
    throw new RangeError("chunkBytes must be below the GitHub Release per-asset limit");
  }

  const source=path.resolve(filePath);
  const out=path.resolve(outputDir);
  const info=await stat(source);
  if(!info.isFile()) throw new Error("input is not a regular file: "+source);

  if(cleanOutput) await rm(out,{recursive:true,force:true});
  await mkdir(out,{recursive:true});

  const totalSize=info.size;
  const totalChunks=Math.max(1,Math.ceil(totalSize/chunkBytes));
  const width=Math.max(2,String(totalChunks-1).length);
  const modelName=path.basename(source);
  const globalHash=createHash("sha256");
  const chunks=[];

  const handle=await open(source,"r");
  try{
    const buffer=Buffer.allocUnsafe(Math.min(1024*1024,chunkBytes));
    let offset=0;
    for(let index=0;index<totalChunks;index++){
      const remaining=totalSize-offset;
      const target=Math.min(chunkBytes,remaining);
      const name=chunkName(modelName,index,width);
      const targetPath=path.join(out,name);
      const output=fs.createWriteStream(targetPath,{flags:"wx"});
      const chunkHash=createHash("sha256");
      let written=0;

      try{
        while(written<target){
          const want=Math.min(buffer.length,target-written);
          const {bytesRead}=await handle.read(buffer,0,want,offset+written);
          if(bytesRead===0) throw new Error("unexpected EOF while sharding "+modelName);
          const bytes=buffer.subarray(0,bytesRead);
          output.write(bytes);
          chunkHash.update(bytes);
          globalHash.update(bytes);
          written+=bytesRead;
        }
        await new Promise((resolve,reject)=>{
          output.once("error",reject);
          output.end(resolve);
        });
      }catch(error){
        output.destroy();
        await rm(targetPath,{force:true});
        throw error;
      }

      const sha=chunkHash.digest("hex");
      chunks.push({index,name,bytes:written,sha256:sha});
      offset+=written;
    }
  }finally{
    await handle.close();
  }

  const manifest={
    schema_version:"1.0.0",
    format:"dinullah/omega-sharded-file",
    algorithm:"sha256",
    model_name:modelName,
    total_size:totalSize,
    total_sha256:globalHash.digest("hex"),
    chunk_size_bytes:chunkBytes,
    chunk_count:chunks.length,
    chunks
  };

  const manifestPath=path.join(out,modelName+"-manifest.json");
  await fs.promises.writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n","utf8");

  return {manifest,manifestPath};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [, , input, output, ...args]=process.argv;
  if(!input||!output){
    console.error("usage: omega-file-sharder.js <input> <output-dir> [chunk-bytes]");
    process.exit(2);
  }
  const chunkBytes=args[0]?Number(args[0]):DEFAULT_CHUNK_BYTES;
  const result=await shardModelFile(input,output,{chunkBytes});
  console.log(JSON.stringify(result.manifest,null,2));
}
