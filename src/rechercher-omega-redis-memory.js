import net from "node:net";
import { createHash } from "node:crypto";

const CRLF=Buffer.from("\r\n");

export function sha256(value){
  return createHash("sha256").update(String(value??""),"utf8").digest("hex");
}

function encodeCommand(parts){
  const values=parts.map(value=>String(value));
  return Buffer.concat([
    Buffer.from("*"+values.length+"\r\n","utf8"),
    ...values.map(value=>{
      const bytes=Buffer.from(value,"utf8");
      return Buffer.concat([
        Buffer.from("$"+bytes.length+"\r\n","utf8"),
        bytes,
        CRLF
      ]);
    })
  ]);
}

function parseReply(buffer,offset=0){
  if(offset>=buffer.length) return null;
  const type=buffer[offset];
  const lineEnd=buffer.indexOf(CRLF,offset+1);
  if(lineEnd<0) return null;

  if(type===0x2b) return {value:buffer.subarray(offset+1,lineEnd).toString("utf8"),next:lineEnd+2};
  if(type===0x2d) return {error:new Error(buffer.subarray(offset+1,lineEnd).toString("utf8")),next:lineEnd+2};
  if(type===0x3a) return {value:Number(buffer.subarray(offset+1,lineEnd).toString("ascii")),next:lineEnd+2};

  if(type===0x24){
    const length=Number(buffer.subarray(offset+1,lineEnd).toString("ascii"));
    const start=lineEnd+2;
    if(length===-1) return {value:null,next:start};
    const end=start+length;
    if(buffer.length<end+2) return null;
    if(!buffer.subarray(end,end+2).equals(CRLF)) throw new Error("invalid Redis bulk string terminator");
    return {value:buffer.subarray(start,end).toString("utf8"),next:end+2};
  }

  if(type===0x2a){
    const count=Number(buffer.subarray(offset+1,lineEnd).toString("ascii"));
    let next=lineEnd+2;
    if(count===-1) return {value:null,next};
    const values=[];
    for(let i=0;i<count;i++){
      const item=parseReply(buffer,next);
      if(!item) return null;
      next=item.next;
      values.push(item.error ?? item.value);
    }
    return {value:values,next};
  }

  throw new Error("unsupported Redis RESP2 reply type: "+String.fromCharCode(type));
}

function createClient({host,port,password}){
  let socket=null;
  let connecting=null;
  let closed=false;
  let authenticated=!password;
  let buffer=Buffer.alloc(0);
  const pending=[];

  function rejectPending(error){
    const batches=[...new Set(pending.splice(0,pending.length).map(item=>item.batch))];
    for(const batch of batches){
      if(!batch.done){batch.done=true;batch.reject(error);}
    }
  }

  function resetSocket(error=null){
    const current=socket;
    socket=null;
    buffer=Buffer.alloc(0);
    authenticated=!password;
    if(error) rejectPending(error);
    if(current && !current.destroyed) current.destroy();
  }

  function flush(){
    while(pending.length){
      const parsed=parseReply(buffer,0);
      if(!parsed) return;
      buffer=buffer.subarray(parsed.next);
      const item=pending.shift();
      const batch=item.batch;
      if(batch.done) continue;
      batch.values[item.index]=parsed.error ?? parsed.value;
      batch.remaining-=1;
      if(batch.remaining===0){
        batch.done=true;
        const failure=batch.values.find(value=>value instanceof Error);
        if(failure) batch.reject(failure);
        else batch.resolve(batch.values);
      }
    }
  }

  function connect(){
    if(closed) return Promise.reject(new Error("REDIS_CLIENT_CLOSED"));
    if(socket && !socket.destroyed) return Promise.resolve();
    if(connecting) return connecting;

    connecting=new Promise((resolve,reject)=>{
      const s=net.createConnection({host,port});
      socket=s;
      let settled=false;

      const fail=error=>{
        if(!settled){settled=true;reject(error);}
        if(socket===s) resetSocket(error);
      };

      s.on("data",chunk=>{
        buffer=Buffer.concat([buffer,chunk]);
        try{flush();}catch(error){fail(error);}
      });

      s.once("connect",()=>{
        settled=true;
        resolve();
      });

      s.once("error",fail);
      s.once("close",()=>{
        if(socket!==s) return;
        socket=null;
        buffer=Buffer.alloc(0);
        authenticated=!password;
        if(pending.length) rejectPending(new Error("REDIS_CONNECTION_CLOSED"));
        if(!settled){settled=true;reject(new Error("REDIS_CONNECTION_CLOSED"));}
      });

      s.setTimeout(10000,()=>fail(new Error("REDIS_TIMEOUT")));
    }).finally(()=>{connecting=null;});

    return connecting;
  }

  async function sendBatch(commands){
    if(!socket || socket.destroyed) throw new Error("REDIS_NOT_CONNECTED");
    if(!Array.isArray(commands)||commands.length===0) throw new TypeError("Redis command batch is required");

    return new Promise((resolve,reject)=>{
      const batch={values:new Array(commands.length),remaining:commands.length,resolve,reject,done:false};
      commands.forEach((_,index)=>pending.push({batch,index}));
      try{
        socket.write(Buffer.concat(commands.map(encodeCommand)));
      }catch(error){
        for(let i=pending.length-1;i>=0;i--) if(pending[i].batch===batch) pending.splice(i,1);
        batch.done=true;
        reject(error);
      }
    });
  }

  async function commandBatch(commands){
    if(closed) throw new Error("REDIS_CLIENT_CLOSED");
    await connect();

    if(password && !authenticated){
      const authReplies=await sendBatch([["AUTH",password]]);
      if(authReplies[0]!=="OK") throw new Error("REDIS_AUTH_FAILED");
      authenticated=true;
    }

    return sendBatch(commands);
  }

  return Object.freeze({
    commandBatch,
    async close(){
      closed=true;
      rejectPending(new Error("REDIS_CLIENT_CLOSED"));
      if(socket) socket.end();
      socket=null;
      buffer=Buffer.alloc(0);
    }
  });
}

export function createRedisConversationMemory({
  host=process.env.REDIS_HOST||"127.0.0.1",
  port=Number(process.env.REDIS_PORT||6379),
  password=process.env.REDIS_PASSWORD||null,
  keyPrefix=process.env.REDIS_KEY_PREFIX||"dinullah:conversation:",
  ttlSeconds=Number(process.env.REDIS_SESSION_TTL_SECONDS||3600),
  maxTurns=Number(process.env.REDIS_MAX_TURNS||20)
}={}){
  if(!Number.isInteger(ttlSeconds)||ttlSeconds<60) throw new RangeError("ttlSeconds must be >= 60");
  if(!Number.isInteger(maxTurns)||maxTurns<1||maxTurns>1000) throw new RangeError("maxTurns must be between 1 and 1000");

  const client=createClient({host,port,password});
  const sessionKey=sessionId=>keyPrefix+sha256(sessionId).slice(0,32);

  return Object.freeze({
    enabled:true,
    persistence:"redis-digest-only",
    maxTurns,
    ttlSeconds,

    async appendDigest({
      sessionId,
      role,
      content,
      timestamp=Date.now(),
      evidenceIds=[],
      outputSha256=null,
      verified=false
    }={}){
      if(!sessionId||!role||typeof content!=="string") throw new TypeError("sessionId, role and content are required");
      if(!["system","user","assistant","tool"].includes(role)) throw new TypeError("invalid conversation role");

      const record=JSON.stringify({
        role,
        content_sha256:sha256(content),
        chars:content.length,
        timestamp,
        evidence_ids:Array.isArray(evidenceIds)?evidenceIds.filter(Boolean).slice(0,50):[],
        output_sha256:outputSha256||null,
        verified:verified===true
      });
      const key=sessionKey(sessionId);

      const replies=await client.commandBatch([
        ["MULTI"],
        ["RPUSH",key,record],
        ["LTRIM",key,String(-maxTurns),"-1"],
        ["EXPIRE",key,String(ttlSeconds)],
        ["EXEC"]
      ]);
      const transaction=replies[4];
      if(!Array.isArray(transaction)) throw new Error("REDIS_TRANSACTION_FAILED");

      return {
        sessionId,
        key,
        content_sha256:sha256(content),
        ttlSeconds,
        maxTurns
      };
    },

    async snapshotDigests({sessionId}={}){
      if(!sessionId) throw new TypeError("sessionId is required");
      const replies=await client.commandBatch([["LRANGE",sessionKey(sessionId),"0","-1"]]);
      return replies[0]||[];
    },

    async ttl({sessionId}={}){
      if(!sessionId) throw new TypeError("sessionId is required");
      const replies=await client.commandBatch([["TTL",sessionKey(sessionId)]]);
      return Number(replies[0]);
    },

    async ping(){
      const replies=await client.commandBatch([["PING"]]);
      return replies[0]==="PONG";
    },

    async clear({sessionId}={}){
      if(!sessionId) throw new TypeError("sessionId is required");
      const replies=await client.commandBatch([["DEL",sessionKey(sessionId)]]);
      return Number(replies[0]);
    },

    async close(){
      await client.close();
    }
  });
}
