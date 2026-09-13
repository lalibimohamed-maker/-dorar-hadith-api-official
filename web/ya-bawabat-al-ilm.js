(() => {
  'use strict';

  const STORAGE_KEY = 'deenAllah.voice.locale';
  const locales = ['ar', 'en', 'fr', 'es', 'tr', 'ur', 'id', 'ms', 'bn', 'fa', 'ru', 'sw'];
  const labels = {
    ar: 'يا بوابة العلم', en: 'Ya Bawabat Al-Ilm', fr: 'Ya Bawabat Al-Ilm', es: 'Ya Bawabat Al-Ilm',
    tr: 'Ya Bawabat Al-Ilm', ur: 'یا بوابة العلم', id: 'Ya Bawabat Al-Ilm', ms: 'Ya Bawabat Al-Ilm',
    bn: 'ইয়া বাওয়াবাতুল ইলম', fa: 'یا بوابة العلم', ru: 'Ya Bawabat Al-Ilm', sw: 'Ya Bawabat Al-Ilm'
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const state = { locale: localStorage.getItem(STORAGE_KEY) || 'ar', listening: false };

  function localeForRecognition(locale) {
    return ({ ar: 'ar-SA', en: 'en-US', fr: 'fr-FR', es: 'es-ES', tr: 'tr-TR', ur: 'ur-PK',
      id: 'id-ID', ms: 'ms-MY', bn: 'bn-BD', fa: 'fa-IR', ru: 'ru-RU', sw: 'sw-KE' })[locale] || locale;
  }

  function setLocale(locale) {
    if (!locales.includes(locale)) return false;
    state.locale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    return true;
  }

  function speak(text, locale = state.locale) {
    if (!synth || !text) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = localeForRecognition(locale);
    synth.speak(u);
    return true;
  }

  function listen(onResult, onError) {
    if (!SpeechRecognition) {
      onError?.(new Error('SpeechRecognition is not supported by this browser.'));
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = localeForRecognition(state.locale);
    recognition.interimResults = true;
    recognition.continuous = false;
    state.listening = true;
    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(r => r[0]?.transcript || '').join(' ').trim();
      onResult?.(transcript, event);
    };
    recognition.onerror = event => { state.listening = false; onError?.(event.error || event); };
    recognition.onend = () => { state.listening = false; };
    recognition.start();
    return recognition;
  }

  function parseCommand(text) {
    const q = String(text || '').trim();
    if (!q) return { intent: 'empty', query: '' };
    const lower = q.toLocaleLowerCase();
    if (/^(يا\s*)?بوابة\s*العلم/.test(q) || lower.includes('ya bawabat al-ilm')) {
      return { intent: 'wake', query: q.replace(/^(يا\s*)?بوابة\s*العلم\s*/i, '').trim() };
    }
    if (/^(ابحث|بحث|اسأل|اختبرني|اختبرني في)/.test(q)) return { intent: 'command', query: q };
    return { intent: 'query', query: q };
  }

  function install({ button, output, localeSelect, searchInput } = {}) {
    if (localeSelect) {
      localeSelect.value = state.locale;
      localeSelect.addEventListener('change', () => setLocale(localeSelect.value));
    }
    if (!button) return;
    button.addEventListener('click', () => {
      if (!SpeechRecognition) {
        if (output) output.textContent = 'التعرف الصوتي غير مدعوم في هذا المتصفح. استخدم متصفحاً يدعم Web Speech API.';
        return;
      }
      if (output) output.textContent = `🎙️ ${labels[state.locale]} يستمع…`;
      listen((text) => {
        if (searchInput) searchInput.value = parseCommand(text).query || text;
        if (output) output.textContent = `🗣️ ${text}`;
        document.dispatchEvent(new CustomEvent('deenallah:voice-query', { detail: parseCommand(text) }));
      }, (err) => {
        if (output) output.textContent = `تعذر تشغيل الإدخال الصوتي: ${String(err)}`;
      });
    });
  }

  window.DeenAllahVoice = { locales, labels, state, setLocale, speak, listen, parseCommand, install };
})();
