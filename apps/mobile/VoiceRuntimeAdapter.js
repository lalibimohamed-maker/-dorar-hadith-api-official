import { createMobileRuntimeBridge } from '../../src/mobile-runtime-bridge.js';
import { createVoicePermissionLifecycle } from '../../src/voice-permission-lifecycle.js';
import { createNativeDictationSession } from '../../src/native-dictation-session.js';

export function createVoiceRuntimeAdapter({ requestPermission, readPermission, onEvent, dictationTransport } = {}) {
  const bridge = createMobileRuntimeBridge({ onEvent });
  const dictation = dictationTransport ? createNativeDictationSession({ transport: dictationTransport }) : null;
  const permissions = createVoicePermissionLifecycle({ requestPermission, readPermission });

  return Object.freeze({
    bridge,
    permissions,
    dictation,
    async initialize() {
      const permission = await permissions.refresh();
      if (permission !== 'granted') return { ready: false, permission };
      bridge.ready();
      return { ready: true, permission };
    }
  });
}
