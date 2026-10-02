package dinullah.voice

/** Platform boundary for Al-Huda native voice invocation. */
interface VoiceRuntimeBridge {
    fun startListening()
    fun stopListening()
    fun deliverAudioFrame(samples: FloatArray, sampleRate: Int)
    fun signalWakeWord()
    fun signalBargeIn()
}
