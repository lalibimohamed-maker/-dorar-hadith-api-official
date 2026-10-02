export interface AlHudaVoicePlatformBridge {
  requestMicrophonePermission(): Promise<boolean>;
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  deliverAudioFrame(samples: Float32Array, sampleRate: number): void;
  signalWakeWord(): void;
  signalBargeIn(): void;
}

export class AlHudaVoiceRuntime {
  private bridge?: AlHudaVoicePlatformBridge;
  private active: boolean = false;

  bind(bridge: AlHudaVoicePlatformBridge): void {
    this.bridge = bridge;
  }

  async start(): Promise<boolean> {
    if (!this.bridge) {
      throw new Error('Al-Huda HarmonyOS bridge is not bound');
    }
    const granted = await this.bridge.requestMicrophonePermission();
    if (!granted) return false;
    await this.bridge.startListening();
    this.active = true;
    return true;
  }

  async stop(): Promise<void> {
    if (this.bridge) await this.bridge.stopListening();
    this.active = false;
  }

  interrupt(): void {
    this.bridge?.signalBargeIn();
  }

  isActive(): boolean {
    return this.active;
  }
}
