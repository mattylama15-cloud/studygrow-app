// Robustní čtení nahlas (TTS), které funguje i na webu.
//
// Problém: na webu jede expo-speech přes Web Speech API prohlížeče. Když natvrdo
// vynutíš language: 'cs-CZ' a prohlížeč český hlas nemá, přehrávání SELŽE TIŠE.
// Řešení: vybereme nejlepší dostupný hlas (nejdřív preferovaný jazyk, jinak
// jakýkoli), a když jazyk chybí, necháme prohlížeč použít default místo selhání.

import * as Speech from 'expo-speech';
import type { Lang } from './types';
import { Platform } from 'react-native';

let cachedVoices: Speech.Voice[] | null = null;

async function loadVoices(): Promise<Speech.Voice[]> {
  if (cachedVoices) return cachedVoices;
  try {
    cachedVoices = await Speech.getAvailableVoicesAsync();
  } catch {
    cachedVoices = [];
  }
  return cachedVoices;
}

/** Přečte text nahlas v daném jazyce, s fallbackem na dostupný hlas. */
export async function speak(text: string, lang: Lang = 'en') {
  const clean = (text || '').trim();
  if (!clean) return;
  Speech.stop();

  const wantPrefix = lang;
  const voices = await loadVoices();
  const match = voices.find((v) => v.language?.toLowerCase().startsWith(wantPrefix));

  const opts: Speech.SpeechOptions = { rate: 0.95, pitch: 1.0 };
  if (match) {
    opts.voice = match.identifier;
    opts.language = match.language;
  } else if (voices.length === 0 && Platform.OS !== 'web') {
    // Nativně obvykle hlas je — nech language, ať se použije systémový.
    opts.language = { cs: 'cs-CZ', en: 'en-US', de: 'de-DE', es: 'es-ES' }[lang];
  }
  // Když na webu český hlas není, záměrně NEnastavujeme language →
  // prohlížeč použije výchozí hlas a aspoň něco přečte, místo ticha.

  Speech.speak(clean, opts);
}

export function stopSpeaking() {
  Speech.stop();
}
