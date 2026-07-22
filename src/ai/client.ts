// Public AI client surface — the rest of the app keeps importing from here.
// All actual work is delegated to the active provider (cloud Groq or on-device Llama).
// Swap providers in `provider.ts` by changing one import line.

import { provider } from './provider';
import { ChatMessage } from '../types';

export { AIError, setAiLang, getAiLang } from './provider';
export type { GeneratedCard, GeneratedQuiz, PlanItem, CardIssue, ExplainStyle } from './provider';

export const DEFAULT_MODEL = provider.defaultModel;
export const HAS_DEFAULT_KEY = provider.hasDefaultKey;

// Schopnosti aktivního provideru — UI podle nich schovává funkce,
// které by aktuální model neutáhl (důležité pro on-device Llamu 1B).
export const AI_CAPS = provider.capabilities;
export type { AICapabilities } from './provider';

export const MODELS = [{ id: provider.defaultModel, label: provider.defaultModel }];

// Convenience used by Settings/Admin screens to check whether AI is wired up.
export function resolveKey(userKey: string | null): string | null {
  return provider.resolveKey(userKey);
}

export function tutorReply(
  history: ChatMessage[],
  apiKey: string | null,
  model: string,
  images?: string[] | null,
  extraSystemContext?: string | null,
) {
  return provider.tutorReply(history, apiKey, model, images, extraSystemContext);
}

export function generateFlashcards(source: string, count: number, apiKey: string | null, model: string, focus?: string) {
  return provider.generateFlashcards(source, count, apiKey, model, focus);
}

export function generateQuiz(source: string, count: number, apiKey: string | null, model: string) {
  return provider.generateQuiz(source, count, apiKey, model);
}

export function summarizeToNotes(source: string, apiKey: string | null, model: string) {
  return provider.summarizeToNotes(source, apiKey, model);
}

export function extractTextFromImage(base64DataUrl: string, apiKey: string | null) {
  return provider.extractTextFromImage(base64DataUrl, apiKey);
}

export function explainCard(
  front: string,
  back: string,
  style: import('./provider').ExplainStyle,
  apiKey: string | null,
  model: string
) {
  return provider.explainCard(front, back, style, apiKey, model);
}

export function checkDeck(cards: { front: string; back: string }[], apiKey: string | null, model: string) {
  return provider.checkDeck(cards, apiKey, model);
}

export function planStudySession(
  availableMinutes: number,
  goal: string,
  context: string,
  apiKey: string | null,
  model: string
) {
  return provider.planStudySession(availableMinutes, goal, context, apiKey, model);
}
