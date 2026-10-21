import { useCallback, useEffect, useState } from 'react';

const LANG_TAGS = { en: ['en-IN', 'en-GB', 'en-US'], hi: ['hi-IN'], ta: ['ta-IN'] };

/** Thin wrapper around the browser-native Web Speech Synthesis API. */
export function useSpeech(preferredLang = 'en') {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const speak = useCallback((text, { rate = 1 } = {}) => {
    if (!supported || !text) return false;
    const u = new SpeechSynthesisUtterance(text);
    const tags = [...(LANG_TAGS[preferredLang] || []), ...LANG_TAGS.en];
    const voice = tags.map((t) => voices.find((v) => v.lang === t)).find(Boolean)
      || voices.find((v) => v.lang?.startsWith('en'));
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = rate;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  }, [supported, voices, preferredLang]);

  const cancel = useCallback(() => supported && window.speechSynthesis.cancel(), [supported]);

  return { supported, speak, cancel };
}
