import { AICharacter } from '../types/game';

/**
 * Speaks a character's dialogue line using the browser's Web Speech API,
 * selecting an appropriate voice based on the character's configured gender,
 * voicePreset, pitch, and rate.
 */
export function speakCharacterLine(character: AICharacter, text: string, forceSpeak = false) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!forceSpeak && !character.voiceConfig?.enabled) return;

  try {
    window.speechSynthesis.cancel();
    const cleaned = text.replace(/[*_~`]/g, '').trim();
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    const voices = window.speechSynthesis.getVoices();

    const preset = character.voiceConfig?.voicePreset || 'auto';
    const isFemale =
      preset === 'soft-female' ||
      preset === 'bright-female' ||
      (preset === 'auto' && character.gender === 'Female');
    const isMale =
      preset === 'warm-male' ||
      preset === 'deep-male' ||
      preset === 'energetic-male' ||
      (preset === 'auto' && character.gender === 'Male');

    if (voices.length > 0) {
      const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
      const pool = englishVoices.length > 0 ? englishVoices : voices;

      let matchedVoice: SpeechSynthesisVoice | undefined;
      if (isFemale) {
        matchedVoice = pool.find((v) =>
          /female|samantha|victoria|karen|zira|google uk english female|aria|jenny|susan|hazel/i.test(
            v.name
          )
        );
      } else if (isMale) {
        matchedVoice = pool.find((v) =>
          /male|daniel|alex|david|mark|google uk english male|guy|christopher|eric|andrew/i.test(
            v.name
          )
        );
      }
      utterance.voice = matchedVoice || pool[0];
    }

    // Apply pitch & rate influenced by gender, voice preset, and personality
    let pitch = character.voiceConfig?.pitch ?? (isFemale ? 1.12 : isMale ? 0.92 : 1.0);
    let rate = character.voiceConfig?.rate ?? 1.0;

    if (preset === 'deep-male') pitch = Math.min(pitch, 0.84);
    if (preset === 'soft-female') {
      pitch = Math.max(pitch, 1.14);
      rate = Math.min(rate, 0.95);
    }
    if (preset === 'energetic-male' || preset === 'bright-female') {
      rate = Math.max(rate, 1.06);
    }

    utterance.pitch = Math.max(0.5, Math.min(1.6, pitch));
    utterance.rate = Math.max(0.65, Math.min(1.45, rate));
    utterance.volume = 0.9;

    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on restricted browsers
  }
}

export function stopCharacterSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
