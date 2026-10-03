import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceProfileManager } from '../src/voice-profile-manager.js';
import { createVoiceAgentBindingStore } from '../src/voice-agent-binding.js';

test('agent voice binding accepts only an active consented profile', () => {
  const profiles=createVoiceProfileManager();
  profiles.create({id:'voice-a',owner:'local-user'});
  const bindings=createVoiceAgentBindingStore({profileStore:profiles});
  assert.throws(()=>bindings.bind({clientId:'codex-cli',profileId:'voice-a'}),/consented and active/);
  profiles.recordConsent('voice-a',true);
  profiles.activate('voice-a');
  const binding=bindings.bind({clientId:'codex-cli',profileId:'voice-a'});
  assert.equal(binding.clientId,'codex-cli');
  assert.equal(bindings.resolve('codex-cli'),'voice-a');
});

test('explicit voice profile takes precedence and must itself pass consent gates', () => {
  const profiles=createVoiceProfileManager();
  profiles.create({id:'voice-a',owner:'u'});
  profiles.create({id:'voice-b',owner:'u'});
  profiles.recordConsent('voice-a',true);
  profiles.activate('voice-a');
  profiles.recordConsent('voice-b',true);
  profiles.activate('voice-b');
  const bindings=createVoiceAgentBindingStore({profileStore:profiles});
  bindings.bind({clientId:'agent',profileId:'voice-a'});
  assert.equal(bindings.resolve('agent','voice-b'),'voice-b');
  assert.throws(()=>bindings.resolve('agent','missing'),/not active and consented/);
});

test('agent unbind removes the association', () => {
  const bindings=createVoiceAgentBindingStore();
  bindings.bind({clientId:'agent-2',profileId:'voice-x'});
  assert.equal(bindings.resolve('agent-2'),'voice-x');
  assert.deepEqual(bindings.unbind('agent-2'),{clientId:'agent-2',unbound:true});
  assert.equal(bindings.resolve('agent-2'),null);
});
