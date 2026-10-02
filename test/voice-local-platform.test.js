import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertVoicePlatformUrl,
  buildTranscriptionRequest,
  buildSpeechRequest,
  buildMcpEndpoint,
  buildStreamingTranscriptionEndpoint,
  buildSpeechDiscoveryEndpoint,
  buildVoicesEndpoint,
  buildVoiceAuthHeaders,
  buildModelsEndpoint,
  buildTranslationRequest,
  buildJsonRpcEndpoint,
} from '../src/voice-local-platform.js';

test('voice platform defaults to loopback and OpenAI-compatible routes', () => {
  assert.equal(assertVoicePlatformUrl('http://127.0.0.1:3900').hostname,'127.0.0.1');
  assert.match(buildTranscriptionRequest({audioFile:'/tmp/q.webm'}).url,/\/v1\/audio\/transcriptions$/);
  assert.equal(buildSpeechRequest({text:'السلام عليكم'}).json.stream_format,'audio');
  assert.match(buildMcpEndpoint(),/\/mcp\/$/);
});

test('remote voice platform is never implicit', () => {
  assert.throws(()=>assertVoicePlatformUrl('http://192.168.1.10:3900'),/explicit opt-in/);
  assert.throws(()=>buildMcpEndpoint({baseUrl:'http://192.168.1.10:3900'}),/explicit opt-in/);
  assert.equal(assertVoicePlatformUrl('https://voice.example',{allowRemote:true}).protocol,'https:');
  assert.match(buildMcpEndpoint({baseUrl:'https://voice.example',allowRemote:true}),/^https:\/\/voice\.example\/mcp\/$/);
});

test('speech request validates stream format', () => {
  assert.equal(buildSpeechRequest({text:'x',streamFormat:'sse'}).json.stream_format,'sse');
  assert.throws(()=>buildSpeechRequest({text:'x',streamFormat:'pcm'}),/invalid speech stream format/);
});

test('voice platform exposes verified models, translation and JSON-RPC routes', () => {
  assert.match(buildModelsEndpoint(),/\\/v1\\/models$/);
  assert.match(buildTranslationRequest({audioFile:'/tmp/q.webm'}).url,/\\/v1\\/audio\\/translations$/);
  assert.equal(buildJsonRpcEndpoint(),'http://127.0.0.1:3902/rpc');
});
