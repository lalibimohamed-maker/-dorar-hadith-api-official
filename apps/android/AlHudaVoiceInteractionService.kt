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
        // Android may instantiate the service during discovery before selection is finalized.\n        // Only enable system invocation when this service is actually selected.\n        if (isSelectedAssistant()) {\n            // Start only lightweight local wake detection; heavy inference stays off this callback.\n        }
    }

    override fun onShutdown() {
        // Stop hotwording and release lightweight native handles when selected.
        super.onShutdown()
    }
}
