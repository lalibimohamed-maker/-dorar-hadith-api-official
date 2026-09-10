import fs from 'node:fs';

const [suitePath, promptId, videoName, outputPath] = process.argv.slice(2);
if (!suitePath || !promptId || !videoName || !outputPath) {
  throw new Error('Usage: node make-vbench-prompt-file.mjs <prompt-suite.json> <prompt-id> <video-name.mp4> <output.json>');
}

const suite = JSON.parse(fs.readFileSync(suitePath, 'utf8'));
const clip = suite.clips?.find((item) => item.id === promptId);
if (!clip) throw new Error(`Unknown prompt id: ${promptId}`);

fs.writeFileSync(outputPath, JSON.stringify({ [videoName]: clip.prompt }, null, 2) + '\n');
console.log(`Wrote VBench custom prompt mapping for ${promptId} -> ${videoName}`);
