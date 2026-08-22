const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'data', 'rijal');
const files = ['narrators.jsonl', 'judgments.jsonl', 'teacher-student-links.jsonl', 'source-locations.jsonl'];

function validateFile(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return { file: name, exists: false, records: 0 };
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  lines.forEach((line, i) => {
    const record = JSON.parse(line);
    if (!record.sourceId) throw new Error(`${name}:${i + 1}: missing sourceId`);
    if (!record.location) throw new Error(`${name}:${i + 1}: missing source location`);
    if (!record.verification) throw new Error(`${name}:${i + 1}: missing verification state`);
  });
  return { file: name, exists: true, records: lines.length };
}

console.log(JSON.stringify(files.map(validateFile), null, 2));
