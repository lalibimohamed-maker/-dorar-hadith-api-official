import Foundation

/// Platform boundary for Al-Huda native voice invocation.
/// The actual microphone/AudioUnit/AVAudioEngine implementation is intentionally
/// platform-owned; this contract is what the shared runtime consumes.
protocol VoiceRuntimeBridge {
    func startListening() throws
    func stopListening()
    func deliverAudioFrame(_ samples: [Float], sampleRate: Int)
    func signalWakeWord()
    func signalBargeIn()
}
