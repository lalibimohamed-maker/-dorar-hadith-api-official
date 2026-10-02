import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertVoicePlatformUrl,
  buildTranscriptionRequest,
  buildSpeechRequest,
  buildMcpEndpoint,
  buildStreamingTranscriptionEndpoint,
  buildModelsEndpoint,
  buildTranslationRequest,
  buildJsonRpcEndpoint,
  buildOutputSessionCreateRequest,
  buildOutputSessionInsertRequest,
  buildOutputSessionCancelRequest,
  buildSpeechDiscoveryEndpoint,
  buildVoiceStudioInputAudioEndMessage,
  buildVoiceStudioMcpHeaders,
  buildNativeDictationControlRequest,
  buildJsonRpcRequest,
} from '../src/voice-local-platform.js';

test('voice platform defaults to loopback and OpenAI-compatible routes', () => {
  assert.equal(assertVoicePlatformUrl('http://127.0.0.1:3900').hostname,'127.0.0.1');
  assert.match(buildTranscriptionRequest({audioFile:'/tmp/q.webm'}).url,/\/v1\/audio\/transcriptions$/);
  assert.equal(buildTranscriptionRequest({audioFile:'/tmp/q.webm'}).form.response_format,'json');
  assert.equal(buildSpeechRequest({text:'السلام عليكم'}).json.response_format,'wav');
  assert.equal(buildSpeechRequest({text:'السلام عليكم'}).json.stream_format,'audio');
  assert.match(buildMcpEndpoint(),/\/mcp\/$/);
});

test('remote voice platform is never implicit', () => {
  assert.throws(()=>assertVoicePlatformUrl('http://192.168.1.10:3900'),/explicit opt-in/);
  assert.throws(()=>buildMcpEndpoint({baseUrl:'http://192.168.1.10:3900'}),/explicit opt-in/);
  assert.equal(assertVoicePlatformUrl('https://voice.example',{allowRemote:true}).protocol,'https:');
  assert.match(buildMcpEndpoint({baseUrl:'https://voice.example',allowRemote:true}),/^https:\/\/voice\.example\/mcp\/$/);
});

test('speech request validates response and stream formats', () => {
  assert.equal(buildSpeechRequest({text:'x',responseFormat:'pcm',streamFormat:'sse',instructions:'clear'}).json.response_format,'pcm');
  assert.equal(buildSpeechRequest({text:'x',responseFormat:'pcm',streamFormat:'sse',instructions:'clear'}).json.stream_format,'sse');
  assert.equal(buildSpeechRequest({text:'x',responseFormat:'pcm',instructions:'clear'}).json.instructions,'clear');
  assert.throws(()=>buildSpeechRequest({text:'x',responseFormat:'sse'}),/invalid speech response format/);
  assert.throws(()=>buildSpeechRequest({text:'x',streamFormat:'pcm'}),/invalid speech stream format/);
});

test('voice platform exposes verified models, translation and JSON-RPC routes', () => {
  assert.match(buildModelsEndpoint(),/\/v1\/models$/);
  assert.match(buildTranslationRequest({audioFile:'/tmp/q.webm'}).url,/\/v1\/audio\/translations$/);
  assert.equal(buildJsonRpcEndpoint(),'http://127.0.0.1:3902/rpc');
});

test('remote WebSocket access uses a scoped ticket endpoint', async () => {
  const { buildWsTicketRequest } = await import('../src/voice-local-platform.js');
  const req=buildWsTicketRequest({baseUrl:'https://voice.example',scope:'/v1/audio/transcriptions/stream',allowRemote:true});
  assert.equal(req.method,'POST');
  assert.equal(req.json.scope,'/v1/audio/transcriptions/stream');
  assert.throws(()=>buildWsTicketRequest({scope:'/admin',allowRemote:true}),/unsupported WebSocket ticket scope/);
});

test('voice platform exposes documented VoiceStudio discovery endpoints', () => {
  assert.equal(
    buildSpeechDiscoveryEndpoint(),
    'http://127.0.0.1:3900/.well-known/voicestudio-speech'
  );
  assert.equal(
    buildSpeechDiscoveryEndpoint({ role: 'control' }),
    'http://127.0.0.1:3902/.well-known/voicestudio-speech'
  );
  assert.throws(
    () => buildSpeechDiscoveryEndpoint({ role: 'sidecar' }),
    /invalid speech discovery role/
  );
});

test('VoiceStudio stream and MCP helpers keep explicit session/client identity', () => {
  assert.deepEqual(buildVoiceStudioInputAudioEndMessage(), { type: 'input_audio.end' });
  assert.deepEqual(
    buildVoiceStudioMcpHeaders({ clientId: 'codex-cli' }),
    { 'X-OmniVoice-Client-Id': 'codex-cli' }
  );
  assert.throws(() => buildVoiceStudioMcpHeaders(), /clientId is required/);
});

test('transcription request preserves documented response and word timestamp options', () => {
  const req = buildTranscriptionRequest({
    audioFile: '/tmp/q.webm',
    language: 'ar',
    prompt: 'بسم الله',
    temperature: 0.2,
    responseFormat: 'verbose_json',
    wordTimestamps: true,
  });
  assert.equal(req.form.response_format, 'verbose_json');
  assert.equal(req.form.timestamp_granularities, 'word');
  assert.equal(req.form.language, 'ar');
  assert.equal(req.form.prompt, 'بسم الله');
  assert.equal(req.form.temperature, 0.2);
  assert.throws(
    () => buildTranscriptionRequest({ audioFile: '/tmp/q.webm', responseFormat: 'mp3' }),
    /invalid transcription response format/
  );
});

test('native dictation HTTP and JSON-RPC controls are strictly allow-listed', () => {
  assert.equal(
    buildNativeDictationControlRequest({ action: 'toggle' }).url,
    'http://127.0.0.1:3902/v1/dictation/toggle'
  );
  assert.equal(
    buildNativeDictationControlRequest({ action: 'start' }).url,
    'http://127.0.0.1:3902/v1/dictation/start'
  );
  assert.throws(
    () => buildNativeDictationControlRequest({ action: 'reset-mic' }),
    /unsupported native dictation action/
  );

  const rpc = buildJsonRpcRequest({
    id: 7,
    method: 'dictation.toggle',
    params: { source: 'al-huda' },
  });
  assert.equal(rpc.url, 'http://127.0.0.1:3902/rpc');
  assert.deepEqual(rpc.json, {
    jsonrpc: '2.0',
    id: 7,
    method: 'dictation.toggle',
    params: { source: 'al-huda' },
  });
  assert.throws(
    () => buildJsonRpcRequest({ method: 'system.exec' }),
    /unsupported local JSON-RPC method/
  );
});
