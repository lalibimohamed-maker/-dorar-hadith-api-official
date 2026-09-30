import net from "node:net";

function encode(parts){
 const body=parts.map(v=>{
   const s=String(v);
   return "$"+Buffer.byteLength(s,"utf8")+"\r\n"+s+"\r\n";
 }).join("");
 return "*"+parts.length+"\r\n"+body;
}
function parseReply(buffer){
 const text=buffer.toString("utf8");
 if(text.startsWith("+"))return {value:text.slice(1).trim(),rest:Buffer.alloc(0)};
 if(text.startsWith(":"))return {value:Number(text.slice(1).trim()),rest:Buffer.alloc(0)};
 if(text.startsWith("$")){
  const i=text.indexOf("\r\n"),n=Number(text.slice(1,i));
  if(n<0)return null; if(n===-1)return {value:null,rest:Buffer.alloc(0)};
  const start=i+2,end=start+n; if(Buffer.byteLength(text,"utf8")<end+2)return null;
  return {value:text.slice(start,end),rest:Buffer.alloc(0)};
 }
 if(text.startsWith("-"))throw new Error(text.slice(1).trim());
 return {value:text.trim(),rest:Buffer.alloc(0)};
}
export function createRedisTcpClient({url=process.env.OMEGA_REDIS_URL||"redis://127.0.0.1:6379"}={}){
 const target=new URL(url); const host=target.hostname||"127.0.0.1",port=Number(target.port||6379);
 const password=target.password?decodeURIComponent(target.password):null;
 let socket=null,buffer=Buffer.alloc(0),queue=[];
 function connect(){
  if(socket)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   socket=net.createConnection({host,port});
   socket.on("data",chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(queue.length){
     const parsed=parseReply(buffer); if(!parsed)break;
     buffer=parsed.rest; const item=queue.shift(); item.resolve(parsed.value);
    }
   });
   socket.once("connect",async()=>{
    try{if(password)await command("AUTH",password);resolve();}catch(e){socket.destroy();socket=null;reject(e);}
   });
   socket.on("error",e=>{while(queue.length)queue.shift().reject(e);socket=null;});
   socket.setTimeout(10000,()=>socket.destroy(new Error("Redis timeout")));
  });
 }
 function command(...args){
  return connect().then(()=>new Promise((resolve,reject)=>{
   queue.push({resolve,reject}); socket.write(encode(args));
  }));
 }
 return Object.freeze({command,close:()=>{if(socket)socket.end();socket=null;}});
}
export function createRedisSessionStore({client=createRedisTcpClient(),prefix="deen:session:",ttlSeconds=86400}={}){
 if(!client||typeof client.command!=="function")throw new TypeError("Redis client is required");
 if(!Number.isInteger(ttlSeconds)||ttlSeconds<60)throw new RangeError("ttlSeconds must be >= 60");
 const key=id=>prefix+String(id);
 return Object.freeze({
  async get(sessionId){const value=await client.command("GET",key(sessionId));return value?JSON.parse(value):null;},
  async set(sessionId,value){const payload=JSON.stringify(value);await client.command("SET",key(sessionId),payload,"EX",ttlSeconds);return true;},
  async delete(sessionId){await client.command("DEL",key(sessionId));return true;}
 });
}
