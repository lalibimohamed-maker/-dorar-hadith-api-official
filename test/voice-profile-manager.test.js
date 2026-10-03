import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceProfileManager } from '../src/voice-profile-manager.js';

test('voice profiles require explicit consent before activation', () => {
  const manager=createVoiceProfileManager();
  manager.create({id:'assistant-ar',owner:'local-user',language:'ar'});
  assert.throws(()=>manager.activate('assistant-ar'),/without consent/);
  manager.recordConsent('assistant-ar',true);
  const active=manager.activate('assistant-ar');
  assert.equal(active.state,'active');
  assert.equal(active.consentRecorded,true);
});

test('Quran recitation cannot use synthetic voice profiles', () => {
  const manager=createVoiceProfileManager();
  assert.throws(
    ()=>manager.create({id:'quran-clone',owner:'local-user',purpose:'quran-recitation'}),
    /not permitted for Quran recitation/
  );
});

test('revoking a profile deletes the stored profile', () => {
  const manager=createVoiceProfileManager();
  manager.create({id:'speaker-1',owner:'local-user'});
  manager.recordConsent('speaker-1',true);
  manager.activate('speaker-1');
  const revoked=manager.revoke('speaker-1');
  assert.equal(revoked.state,'revoked');
  assert.equal(manager.get('speaker-1'),null);
});
