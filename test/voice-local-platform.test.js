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
} from '../src/voice-local-platform.js';

test('voice platform defaults to loopback and OpenAI-compatible routes', () => {
  assert.equal(assertVoicePlatformUrl('http://127.0.0.1:3900').hostname,'127.0.0.1');
  assert.match(buildTranscriptionRequest({audioFile:'/tmp/q.webm'}).url,/\/v1\/audio\/transcriptions$/);
  assert.equal(buildSpeechRequest({text:'السلام عليكم'}).json.response_format,'wav');
  assert.match(buildMcpEndpoint(),/\/mcp\/$/);
});

test('remote voice platform is never implicit', () => {
  assert.throws(()=>assertVoicePlatformUrl('http://192.168.1.10:3900'),/explicit opt-in/);
  assert.throws(()=>buildMcpEndpoint({baseUrl:'http://192.168.1.10:3900'}),/explicit opt-in/);
  assert.equal(assertVoicePlatformUrl('https://voice.example',{allowRemote:true}).protocol,'https:');
  assert.match(buildMcpEndpoint({baseUrl:'https://voice.example',allowRemote:true}),/^https:\/\/voice\.example\/mcp\/$/);
});

test('speech request validates response format', () => {
  assert.equal(buildSpeechRequest({text:'x',responseFormat:'pcm'}).json.response_format,'pcm');
  assert.throws(()=>buildSpeechRequest({text:'x',responseFormat:'sse'}),/invalid speech response format/);
});
