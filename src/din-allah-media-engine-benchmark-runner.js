import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export function probeVideo(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    return { ok: false, reason: 'video_missing' };
  }
  try {
    const raw = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels',
      '-of', 'json', videoPath,
    ], { encoding: 'utf8' });
    const data = JSON.parse(raw);
    const streams = data.streams ?? [];
    const video = streams.find((s) => s.codec_type === 'video');
    const audio = streams.find((s) => s.codec_type === 'audio');
    return {
      ok: Boolean(video),
      video: video ?? null,
      audio: audio ?? null,
      duration: Number(data.format?.duration ?? 0),
    };
  } catch {
    return { ok: false, reason: 'ffprobe_failed' };
  }
}

export function buildScorecard({ candidate, promptId, videoPath, provenance, rights }) {
  const media = probeVideo(videoPath);
  const failed = [];
  if (!media.ok) failed.push('video_integrity');
  if (!provenance || provenance.status !== 'complete') failed.push('provenance');
  if (!rights || rights.status !== 'verified') failed.push('rights');

  return {
    schemaVersion: '1.0.0',
    candidate,
    promptId,
    status: failed.length ? 'blocked' : 'ready_for_evaluation',
    hardFail: failed.length > 0,
    failedGates: failed,
    media,
    provenance: provenance ?? null,
    rights: rights ?? null,
    scores: failed.length ? null : {
      vbench2: null,
      vbench: null,
      scientificPlausibility: null,
      temporalConsistency: null,
      audioIntegrity: Boolean(media.audio),
      quranTextIntegrity: null,
      recitationAssetIntegrity: null,
      unintendedText: null,
    },
  };
}

export function writeScorecard(outputPath, input) {
  const output = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(buildScorecard(input), null, 2) + '\n');
  return output;
}
