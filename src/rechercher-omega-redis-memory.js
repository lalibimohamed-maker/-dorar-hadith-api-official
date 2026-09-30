import net from "node:net";
import { createHash } from "node:crypto";

function digest(value){return createHash("sha256").update(String(value??""),"utf8").digest("hex");}

function encodeCommand(parts){
  return "*"+parts.length+"\r\n"+parts.map(p=>"$"+Buffer.byteLength(String(p))+"\r\n"+String(p)+"\r\n").join("");
}
function readReply(socket){
  return new Promise((resolve,reject)=>{
    let data="";
    const onData=chunk=>{data+=chunk.toString(); if(data.includes("\r\n")){socket.off("data",onData);const line=data.split("\r\n",1)[0];if(line.startsWith("-"))reject(new Error(line.slice(1)));else resolve(line);}};
    socket.on("data",onData); socket.once("error",reject);
  });
}
async function command({host,port,password},parts){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host,port},async()=>{
      try{
        if(password){socket.write(encodeCommand(["AUTH",password]));await readReply(socket);}
        socket.write(encodeCommand(parts)); const result=await readReply(socket); socket.end(); resolve(result);
      }catch(e){socket.destroy();reject(e);}
    });
    socket.once("error",reject);
  });
}

export function createRedisConversationMemory({host=process.env.REDIS_HOST||"127.0.0.1",port=Number(process.env.REDIS_PORT||6379),password=process.env.REDIS_PASSWORD,keyPrefix="dinullah:conversation:"}={}){
  return Object.freeze({
    enabled:true,
    async appendDigest({sessionId,role,content,timestamp=Date.now()}={}){
      if(!sessionId||!role||typeof content!=="string") throw new TypeError("sessionId, role and content are required");
      const record=JSON.stringify({role,content_sha256:digest(content),chars:content.length,timestamp});
      const key=keyPrefix+sessionId;
      await command({host,port,password},["RPUSH",key,record]);
      return {sessionId,key,content_sha256:digest(content)};
    },
    async snapshotDigests({sessionId}={}){
      if(!sessionId) throw new TypeError("sessionId is required");
      const raw=await command({host,port,password},["LRANGE",keyPrefix+sessionId,"0","-1"]);
      return raw==="*"||raw==="$-1"?[]:raw;
    },
    async clear({sessionId}={}){
      if(!sessionId) throw new TypeError("sessionId is required");
      return command({host,port,password},["DEL",keyPrefix+sessionId]);
    }
  });
}
