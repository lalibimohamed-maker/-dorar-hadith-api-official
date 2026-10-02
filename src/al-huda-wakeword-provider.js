import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

export function createAlHudaWakeWordProvider({
  modelPath,
  python = 'python3',
  runnerPath = 'scripts/al-huda-kws-runner.py',
  threshold = 0.80,
  timeoutMs = 10_000
} = {}) {
  if (!modelPath) throw new TypeError('modelPath is required');
  if (threshold < 0 || threshold > 1) throw new RangeError('threshold must be between 0 and 1');
  return Object.freeze({
    supports(capability) { return capability === 'wake-word'; },
    async detect(audioPath) {
      if (!audioPath || !existsSync(modelPath)) throw new Error('KWS model or audio path is missing');
      await fs.access(audioPath);
      const payload=JSON.stringify({model:modelPath,audio:audioPath,threshold});
      return await new Promise((resolve,reject)=>{
        const child=spawn(python,[runnerPath],{stdio:['pipe','pipe','pipe']});
        let stdout='',stderr='';
        const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Al-Huda KWS timeout'));},timeoutMs);
        child.stdout.on('data',b=>stdout+=b);
        child.stderr.on('data',b=>stderr+=b);
        child.on('error',e=>{clearTimeout(timer);reject(e);});
        child.on('close',code=>{
          clearTimeout(timer);
          if(code!==0){reject(new Error(stderr.trim()||`KWS runner exited with code ${code}`));return;}
          try{
            const r=JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1));
            if(!r.ok) throw new Error(r.error||'KWS failed');
            resolve(r);
          }catch(e){reject(e);}
        });
        child.stdin.end(payload+'\n');
      });
    }
  });
}
