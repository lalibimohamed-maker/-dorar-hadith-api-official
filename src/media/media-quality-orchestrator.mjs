import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const CONFIG_PATH = path.resolve('config/media-quality-pipeline-2026.json');
export function loadMediaConfig() { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
export function probeBinary(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000 });
  return { available: result.status === 0, command, version: result.status === 0 ? String(result.stdout || '').split(/\r?\n/, 1)[0] : null };
}
export function engineInventory() {
  return { ffmpeg: probeBinary('ffmpeg'), ffprobe: probeBinary('ffprobe'), realesrgan: probeBinary('realesrgan-ncnn-vulkan'), video2x: probeBinary('video2x') };
}
export function selectImageProfile(inputWidth, inputHeight, requested = 'native') {
  const profile = loadMediaConfig().profiles[requested];
  if (!profile) throw new Error(`Unknown media profile: ${requested}`);
  if (!Number.isInteger(inputWidth) || !Number.isInteger(inputHeight) || inputWidth <= 0 || inputHeight <= 0) throw new Error('Invalid input dimensions');
  if (profile.maxLongEdge == null) return { requested, maxLongEdge: null, scale: null };
  const longEdge = Math.max(inputWidth, inputHeight);
  return { requested, maxLongEdge: profile.maxLongEdge, scale: profile.maxLongEdge / longEdge };
}
export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  return new Promise((resolve, reject) => { stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex'))); stream.on('error', reject); });
}
export function buildDerivedManifest({ inputPath, outputPath, mediaType, profile, engine }) {
  return { schemaVersion: 1, mediaType, profile, engine, input: { path: inputPath, authoritative: true }, output: { path: outputPath, authoritative: false }, policy: { preserveOriginal: true, verifyBeforePromotion: true, noSilentTrustedReplacement: true }, generatedAt: new Date().toISOString() };
}
export function validateTargetDimensions(width, height, requested) {
  const target = selectImageProfile(width, height, requested);
  if (target.maxLongEdge !== null && Math.max(width, height) > target.maxLongEdge) return { allowed: false, reason: 'input-already-exceeds-profile' };
  return { allowed: true, target };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command = 'inventory'] = process.argv.slice(2);
  if (command === 'inventory') { console.log(JSON.stringify(engineInventory(), null, 2)); process.exit(0); }
  if (command === 'profile') { const [width, height, profile = '8k'] = process.argv.slice(3); console.log(JSON.stringify(selectImageProfile(Number(width), Number(height), profile), null, 2)); process.exit(0); }
  process.stderr.write('Usage: node src/media/media-quality-orchestrator.mjs <inventory|profile> ...\n');
  process.exit(2);
}
