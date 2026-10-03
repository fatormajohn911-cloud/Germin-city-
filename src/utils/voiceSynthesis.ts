import { AICharacter } from '../types/game';

/**
 * Speaks a character's dialogue line using the browser's Web Speech API,
 * selecting an appropriate voice based on the character's configured gender,
 * voicePreset, pitch, and rate.
 */
export function speakCharacterLine(_character?: AICharacter, _text?: string, _forceSpeak = false) {
  // NPC-to-Player speech synthesis is completely disabled.
  return;
}

export function stopCharacterSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
