import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const roots=['config','src','apps','web'];
const forbidden=['يا بوابة العلم','Bawabat Al-Ilm'];

function filesUnder(root){
  const out=[];
  const abs=path.resolve(root);
  if(!fs.existsSync(abs)) return out;
  for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
    const p=path.join(abs,entry.name);
    if(entry.isDirectory()) out.push(...filesUnder(path.relative(process.cwd(),p)));
    else if(/\.(json|js|mjs|cjs|swift|kt|xml|md)$/.test(entry.name)) out.push(p);
  }
  return out;
}

test('voice implementation surfaces contain only canonical Al-Huda identity',()=>{
  const hits=[];
  for(const root of roots){
    for(const file of filesUnder(root)){
      const text=fs.readFileSync(file,'utf8');
      if(!file.includes(path.join('docs', ''))) {
        for(const term of forbidden) if(text.includes(term)) hits.push({file,term});
      }
    }
  }
  assert.deepEqual(hits,[],`legacy assistant naming remains in voice implementation surfaces: ${JSON.stringify(hits)}`);
});
