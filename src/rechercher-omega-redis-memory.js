import net from "node:net";
import { createHash } from "node:crypto";

const digest=value=>createHash("sha256").update(String(value??""),"utf8").digest("hex");

function encodeCommand(parts){
  return "*"+parts.length+"\r\n"+parts.map(p=>"$"+Buffer.byteLength(String(p))+"\r\n"+String(p)+"\r\n").join("");
}

function parseResp(buffer){
  const text=buffer.toString();
  let pos=0;
  function line(){const end=text.indexOf("\r\n",pos);if(end<0)throw new Error("incomplete redis reply");const out=text.slice(pos,end);pos=end+2;return out;}
  function value(){
    const head=text[pos++];
    if(head==="+") return line();
    if(head==="-") throw new Error(line());
    if(head==":") return Number(line());
    if(head==="$"){const len=Number(line());if(len===-1)return null;const out=text.slice(pos,pos+len);pos+=len+2;return out;}
    if(head==="*"){const n=Number(line());const arr=[];for(let i=0;i<n;i++)arr.push(value());return arr;}
    throw new Error("unsupported redis reply");
  }
  return value();
}

async function command({host,port,password},parts){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host,port},async()=>{
      try{
        if(password){socket.write(encodeCommand(["AUTH",password]));await new Promise((res,rej)=>{let b=Buffer.alloc(0);const on=c=>{b=Buffer.concat([b,c]);try{parseResp(b);socket.off("data",on);res();}catch{}};socket.on("data",on);socket.once("error",rej);});}
        socket.write(encodeCommand(parts));
        let buffer=Buffer.alloc(0);
        const onData=chunk=>{buffer=Buffer.concat([buffer,chunk]);try{const reply=parseResp(buffer);socket.off("data",onData);socket.end();resolve(reply);}catch{}};
        socket.on("data",onData); socket.once("error",reject);
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
      return (await command({host,port,password},["LRANGE",keyPrefix+sessionId,"0","-1"]))||[];
    },
    async clear({sessionId}={}){
      if(!sessionId) throw new TypeError("sessionId is required");
      return command({host,port,password},["DEL",keyPrefix+sessionId]);
    }
  });
}
