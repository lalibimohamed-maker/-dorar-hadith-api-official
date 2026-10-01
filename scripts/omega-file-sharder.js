#!/usr/bin/env node
import fs from "node:fs";
import { mkdir, rm, open } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  computeChunkIntegrity,
  computeDistributionIntegrity,
  computeRollingStep,
  ROLLING_SHA256_INITIAL
} from "../src/distribution/omega-integrity-chain.js";

export const DEFAULT_CHUNK_BYTES = 1900 * 1024 * 1024;
export const DEFAULT_BLOCK_BYTES = 16 * 1024 * 1024;
export const MAX_GITHUB_RELEASE_ASSET_BYTES = 2147483647;

export function sha256(value){
  return createHash("sha256").update(Buffer.isBuffer(value) ? value : String(value??""),"utf8").digest("hex");
}

function parsePositiveInteger(value,name){
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1) throw new RangeError(name+" must be a positive integer");
  return n;
}

function chunkName(fileName,index,width){
  return fileName+".part-"+String(index).padStart(width,"0");
}

export async function shardModelFile(
  filePath,
  outputDir,
  {chunkBytes=DEFAULT_CHUNK_BYTES,blockBytes=DEFAULT_BLOCK_BYTES,cleanOutput=false,assetPrefix=null}={}
){
  chunkBytes=parsePositiveInteger(chunkBytes,"chunkBytes");
  blockBytes=parsePositiveInteger(blockBytes,"blockBytes");
  if(chunkBytes>=MAX_GITHUB_RELEASE_ASSET_BYTES) {
    throw new RangeError("chunkBytes must be below the GitHub Release per-asset limit");
  }

  const source=path.resolve(filePath);
  const out=path.resolve(outputDir);

  if(cleanOutput) await rm(out,{recursive:true,force:true});
  await mkdir(out,{recursive:true});

  const handle=await open(source,"r");
  try{
    const info=await handle.stat();
    if(!info.isFile()) throw new Error("input is not a regular file: "+source);
    if(info.size < 1) throw new Error("input file must not be empty: "+source);

    const totalSize=info.size;
    const totalChunks=Math.max(1,Math.ceil(totalSize/chunkBytes));
    const width=Math.max(2,String(totalChunks-1).length);
    const modelName=path.basename(source);
    const globalHash=createHash("sha256");
    const chunks=[];

    const buffer=Buffer.allocUnsafe(Math.min(1024*1024,chunkBytes));
    let offset=0;
    for(let index=0;index<totalChunks;index++){
      const remaining=totalSize-offset;
      const target=Math.min(chunkBytes,remaining);
      const name=chunkName(assetPrefix ?? modelName,index,width);
      const targetPath=path.join(out,name);
      const output=fs.createWriteStream(targetPath,{flags:"wx"});
      const chunkHash=createHash("sha256");
      const blockHashes=[];
      let blockHash=createHash("sha256");
      let blockWritten=0;
      let blockOffset=0;
      let written=0;

      try{
        while(written<target){
          const want=Math.min(buffer.length,target-written);
          const {bytesRead}=await handle.read(buffer,0,want,offset+written);
          if(bytesRead===0) throw new Error("unexpected EOF while sharding "+modelName);
          const bytes=buffer.subarray(0,bytesRead);
          if(!output.write(bytes)) await once(output,"drain");
          chunkHash.update(bytes);
          globalHash.update(bytes);

          let localOffset=0;
          while(localOffset<bytes.length){
            const take=Math.min(blockBytes-blockWritten,bytes.length-localOffset);
            const slice=bytes.subarray(localOffset,localOffset+take);
            blockHash.update(slice);
            blockWritten+=take;
            localOffset+=take;
            if(blockWritten===blockBytes){
              blockHashes.push({index:blockHashes.length,offset:blockOffset,bytes:blockWritten,sha256:blockHash.digest("hex")});
              blockOffset+=blockWritten;
              blockHash=createHash("sha256");
              blockWritten=0;
            }
          }
          written+=bytesRead;
        }

        if(blockWritten>0){
          blockHashes.push({index:blockHashes.length,offset:blockOffset,bytes:blockWritten,sha256:blockHash.digest("hex")});
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

      let rolling = ROLLING_SHA256_INITIAL;
      for (const block of blockHashes) {
        rolling = computeRollingStep(rolling, block);
        block.rolling_sha256 = rolling;
      }
      const chunkIntegrity = computeChunkIntegrity(blockHashes);
      const sha=chunkHash.digest("hex");
      chunks.push({
        index,
        name,
        bytes:written,
        sha256:sha,
        block_size_bytes:blockBytes,
        blocks:blockHashes,
        ...chunkIntegrity
      });
      offset+=written;
    }

    const finalInfo=await handle.stat();
    if(finalInfo.size!==totalSize) {
      throw new Error("input file changed during sharding: "+source);
    }

    const manifest={
      schema_version:"1.1.0",
      format:"dinullah/omega-sharded-file",
      algorithm:"sha256",
      model_name:modelName,
      total_size:totalSize,
      total_sha256:globalHash.digest("hex"),
      chunk_size_bytes:chunkBytes,
      block_size_bytes:blockBytes,
      chunk_count:chunks.length,
      integrity: computeDistributionIntegrity(chunks),
      chunks
    };

    const manifestPath=path.join(out,modelName+"-manifest.json");
    await fs.promises.writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n","utf8");

    return {manifest,manifestPath};
  }finally{
    await handle.close();
  }
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [, , input, output, ...args]=process.argv;
  if(!input||!output){
    console.error("usage: omega-file-sharder.js <input> <output-dir> [chunk-bytes] [block-bytes] [asset-prefix]");
    process.exit(2);
  }
  const chunkBytes=args[0]?Number(args[0]):DEFAULT_CHUNK_BYTES;
  const blockBytes=args[1]?Number(args[1]):DEFAULT_BLOCK_BYTES;
  const assetPrefix=args[2]||null;
  const result=await shardModelFile(input,output,{chunkBytes,blockBytes,assetPrefix});
  console.log(JSON.stringify(result.manifest,null,2));
}
