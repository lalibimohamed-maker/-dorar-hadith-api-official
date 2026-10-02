import { createMobileRuntimeBridge } from '../../src/mobile-runtime-bridge.js';
import { createVoicePermissionLifecycle } from '../../src/voice-permission-lifecycle.js';

export function createVoiceRuntimeAdapter({ requestPermission, readPermission, onEvent } = {}) {
  const bridge = createMobileRuntimeBridge({ onEvent });
  const permissions = createVoicePermissionLifecycle({ requestPermission, readPermission });

  return Object.freeze({
    bridge,
    permissions,
    async initialize() {
      const permission = await permissions.refresh();
      if (permission !== 'granted') return { ready: false, permission };
      bridge.ready();
      return { ready: true, permission };
    }
  });
}
