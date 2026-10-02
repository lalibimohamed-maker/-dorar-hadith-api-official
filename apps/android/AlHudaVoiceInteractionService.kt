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
    fun isSelectedAssistant(): Boolean {
        return VoiceInteractionService.isActiveService(this, componentName)
    }
    override fun onReady() {
        super.onReady()
        check(isSelectedAssistant()) { "Al-Huda service is not the active selected assistant" }
        // Install the local hotword detector and keep this path lightweight.
    }

    override fun onShutdown() {
        // Stop hotwording and release lightweight native handles.
        super.onShutdown()
    }
}
