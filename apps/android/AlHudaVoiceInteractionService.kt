package dinullah.voice

import android.service.voice.VoiceInteractionService

/**
 * Android system-selected voice interactor boundary for Al-Huda.
 *
 * Keep this service lightweight. Heavy interaction work belongs in
 * AlHudaVoiceInteractionSessionService, matching Android's VoiceInteractionService
 * lifecycle model.
 */
class AlHudaVoiceInteractionService : VoiceInteractionService() {
    override fun onReady() {
        super.onReady()
        // Install the local hotword detector and keep this path lightweight.
    }

    override fun onShutdown() {
        // Stop hotwording and release lightweight native handles.
        super.onShutdown()
    }
}
