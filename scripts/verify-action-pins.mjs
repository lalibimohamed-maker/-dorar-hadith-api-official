import fs from "node:fs";
import path from "node:path";

const root=".github/workflows";
const files=fs.readdirSync(root).filter(f=>/\.ya?ml$/i.test(f)).map(f=>path.join(root,f));
const violations=[];
for(const file of files){
  const lines=fs.readFileSync(file,"utf8").split(/\r?\n/);
  lines.forEach((line,i)=>{
    const m=line.match(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if(!m) return;
    const ref=m[1];
    if(ref.startsWith("./") || ref.startsWith("docker://")) return;
    const at=ref.lastIndexOf("@");
    if(at<1 || !/^[0-9a-f]{40}$/i.test(ref.slice(at+1))){
      violations.push(`${file}:${i+1}: ${ref}`);
    }
  });
}
if(violations.length){
  console.error("Mutable/unpinned GitHub Action references detected:");
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`All external workflow actions are pinned to immutable 40-character commit SHAs (${files.length} workflow files checked).`);
