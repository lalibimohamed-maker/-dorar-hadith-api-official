package dinullah.voice

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

class AlHudaVoiceInteractionSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return AlHudaVoiceInteractionSession(this)
    }
}

private class AlHudaVoiceInteractionSession(service: VoiceInteractionSessionService) :
    VoiceInteractionSession(service) {
    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        // Connect the native session to Mobile Runtime Bridge -> Qwen3-ASR.
    }
}
