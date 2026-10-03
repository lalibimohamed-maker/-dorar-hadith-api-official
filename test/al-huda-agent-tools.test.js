import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlHudaAgentTools } from '../src/al-huda-agent-tools.js';

test('Al-Huda agent bridge exposes bounded local speech tools', async () => {
  const audits=[];
  const tools=createAlHudaAgentTools({
    providers:{
      health:async()=>({ready:true}),
      listEngines:async()=>[{id:'qwen3-asr-0.6b'}],
      listVoices:async()=>[{id:'default'}],
      listLanguages:async()=>['ar','en'],
      transcribe:async({audio})=>({text:'سؤال',audio}),
      synthesize:async({text})=>({audioRef:'audio://1',text}),
    },
    onAudit:e=>audits.push(e),
  });
  const out=await tools.execute('transcribe',{audio:'input.wav'});
  assert.equal(out.result.text,'سؤال');
  assert.equal(out.audit.assistant,'Al-Huda');
  assert.equal(out.audit.corpusMutation,false);
  assert.equal(audits.length,1);
  assert.ok(tools.operations.includes('synthesize'));
});

test('Al-Huda agent bridge blocks corpus and Quran voice mutation paths', async () => {
  const tools=createAlHudaAgentTools({providers:{}});
  await assert.rejects(()=>tools.execute('modify-corpus'),/blocked Al-Huda operation/);
  await assert.rejects(()=>tools.execute('clone-quran-recitation-voice'),/blocked Al-Huda operation/);
});

test('unconfigured operations fail closed', async () => {
  const tools=createAlHudaAgentTools({providers:{}});
  await assert.rejects(()=>tools.execute('health'),/provider is not configured/);
});

test('Al-Huda agent synthesis resolves a consented per-agent voice profile', async () => {
  const calls=[];
  const tools = createAlHudaAgentTools({
    voiceBindings: {
      resolve(clientId, profileId) {
        calls.push([clientId, profileId]);
        return profileId || 'bound-profile';
      },
    },
    providers: {
      synthesize: async input => input,
    },
  });
  const out=await tools.execute('synthesize',{clientId:'codex-cli',text:'السلام عليكم'});
  assert.equal(out.result.resolvedProfileId,'bound-profile');
  assert.deepEqual(calls,[['codex-cli',undefined]]);
  assert.equal(out.audit.voiceProfileId,'bound-profile');
});
