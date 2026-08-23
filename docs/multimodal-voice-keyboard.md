# Multimodal voice, keyboard and export architecture

## User experience

The search box can expose three input modes: text, keyboard and voice. The client detects the user's language from the spoken/text input and passes the canonical BCP-47 language tag into the multilingual search runtime.

The answer is rendered and spoken in the user's language when a verified speech provider is available. The original user text and detected language remain part of the session record.

### Quran voice policy

Quran text remains Arabic. Quran recitation is never translated into a synthetic recitation. The runtime identifies the requested reciter as **Saad Al-Ghamdi** and requires a verified/authorized audio source before playback or download is offered.

### Keyboard

The keyboard configuration follows the same language state as Settings. It supports RTL/LTR, IME composition, custom layouts, and voice input. A web client may use the browser's native speech-recognition capability; mobile clients should use the platform's speech APIs or a configured provider.

## Global language behavior

Do not hard-code a finite list and claim it represents every language in the world. Use BCP-47 language tags and provider capability discovery. When a provider cannot recognize or synthesize the requested language, the UI must state that limitation and offer a safe fallback rather than silently switching languages.

## Exports

The session export contract supports `mp3`, `mp4-4k`, `pdf`, and `docx`. Binary generation is provider/client responsibility and is gated by `verifiedOnly`. An export must preserve the original question, answer language, citations/provenance, and source references. Video export must not fabricate a Quran recitation, citation, source, or visual attribution.

## Assistant/device control

The runtime is designed as a capability layer for web, iOS and Android clients. Device controls are permission-gated by the operating system. The server cannot and must not assume arbitrary access to microphone, speakers, files, calls, notifications, or device settings. Voice activation can be implemented as an opt-in assistant mode using platform permissions.

## Security and provenance

Speech transcripts, generated audio, and exported conversations are session artifacts. They must inherit the same provenance rules as textual answers. External media is not promoted to a religious source merely because it is found on the web.
