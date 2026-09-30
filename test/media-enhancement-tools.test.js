import test from "node:test";
import assert from "node:assert/strict";
import { buildLoudnessNormalizationCommand, buildFrameSignatureCommand, evaluateSubtitleTiming } from "../src/media/media-enhancement-tools.mjs";

test("loudness normalization produces bounded FFmpeg plan",()=>{
 const p=buildLoudnessNormalizationCommand({inputPath:"in.mp4",outputPath:"out.mp4"});
 assert.equal(p.command,"ffmpeg"); assert.ok(p.args.some(x=>String(x).startsWith("loudnorm=")));
 assert.equal(p.corpus_write_allowed,false);
});
test("frame signatures are deterministic and bounded",()=>{
 const p=buildFrameSignatureCommand({inputPath:"in.mp4",fps:2,width:320});
 assert.equal(p.args[p.args.indexOf("-f")+1],"framemd5");
 assert.equal(p.corpus_write_allowed,false);
});
test("subtitle timing blocks drift beyond the publication threshold",()=>{
 assert.equal(evaluateSubtitleTiming({observedDriftMs:80}).status,"passed");
 assert.equal(evaluateSubtitleTiming({observedDriftMs:250}).status,"blocked");
});
