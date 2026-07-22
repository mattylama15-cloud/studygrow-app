// AIProvider — the SINGLE abstraction the app talks to.
//
// To switch from cloud (Groq) to on-device (Llama + OCR), change ONE line at the
// bottom of this file (the `activeProvider` import). Every screen in the app keeps
// importing from `../ai/client` exactly as before — no other code has to change.

import { ChatMessage, Lang } from '../types';

/**
 * Chyba AI vrstvy. `code` je jazykově nezávislý identifikátor příčiny — kód se
 * podle něj rozhoduje (např. jestli zkusit záložní model), zatímco `message` je
 * už přeložený text pro uživatele, na který se NIKDY nesmí spoléhat v logice.
 */
export type AIErrorCode = 'no-key' | 'bad-key' | 'rate-limit' | 'network' | 'too-large' | 'http' | 'bad-output' | 'unsupported' | 'native-only';

export class AIError extends Error {
  code?: AIErrorCode;
  constructor(message: string, code?: AIErrorCode) {
    super(message);
    this.code = code;
  }
}

// ─── Aktuální jazyk pro AI vrstvu ────────────────────────────────────────────
// Providery jsou obyčejné .ts moduly mimo React, takže nemůžou použít hook
// useT(). Jazyk se sem proto zrcadlí z AppContextu (viz setAiLang) a prompty
// i chybové hlášky si ho berou přes getAiLang().
let _aiLang: Lang = 'en';

/** Nastaví jazyk, ve kterém AI odpovídá a ve kterém se hlásí chyby. */
export function setAiLang(lang: Lang) {
  _aiLang = lang;
}

/** Aktuální jazyk AI vrstvy. */
export function getAiLang(): Lang {
  return _aiLang;
}

export type GeneratedCard = { front: string; back: string };

export type GeneratedQuiz = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export type PlanItem = { task: string; minutes: number };

/** One problem found by the AI deck checker. */
export type CardIssue = { index: number; problem: string; fix: string | null };

/** Styles for the "explain it differently" feature. */
export type ExplainStyle = 'analogy' | 'story' | 'mnemonic' | 'simple';

/**
 * Co daný provider zvládne. UI podle toho schovává funkce — takže po přepnutí
 * na on-device Llamu 1B appka sama nabídne jen to, co malý model utáhne,
 * a nic se nerozbije. Cloudový Groq umí všechno.
 */
export type AICapabilities = {
  chat: boolean;       // AI lektor (volný text)
  explain: boolean;    // „Vysvětli jinak" u kartiček
  summarize: boolean;  // shrnutí poznámek
  flashcards: boolean; // AI generování kartiček
  quiz: boolean;       // AI kvíz z textu (přísný JSON — pro 1B moc těžké)
  checkDeck: boolean;  // AI kontrola balíčku (fakta + JSON — pro 1B moc těžké)
  plan: boolean;       // plán učení (JSON)
  vision: boolean;     // čtení fotek / přílohy v chatu (potřebuje vision model)
};

/** What every AI provider must implement. */
export interface AIProvider {
  /** Tutor chat: takes the conversation history (and optional photos), returns the reply text. */
  tutorReply(
    history: ChatMessage[],
    apiKey: string | null,
    model: string,
    images?: string[] | null,
    extraSystemContext?: string | null,
  ): Promise<string>;

  /**
   * Build study flashcards from a topic or notes excerpt.
   * `focus` = co přesně se uživatel potřebuje naučit; bez něj si AI vybírá sama.
   */
  generateFlashcards(
    source: string,
    count: number,
    apiKey: string | null,
    model: string,
    focus?: string
  ): Promise<GeneratedCard[]>;

  /** Build multiple-choice quiz questions from a topic or notes excerpt. */
  generateQuiz(
    source: string,
    count: number,
    apiKey: string | null,
    model: string
  ): Promise<GeneratedQuiz[]>;

  /** Summarize the given text into structured study notes (markdown). */
  summarizeToNotes(
    source: string,
    apiKey: string | null,
    model: string
  ): Promise<string>;

  /** OCR-like: read the text from a photo (base64 data URL) and return it as plain text. */
  extractTextFromImage(
    base64DataUrl: string,
    apiKey: string | null
  ): Promise<string>;

  /** Turn available time + goal into a study to-do list. */
  planStudySession(
    availableMinutes: number,
    goal: string,
    context: string,
    apiKey: string | null,
    model: string
  ): Promise<PlanItem[]>;

  /** Explain one flashcard a different way (analogy / story / mnemonic / simple). */
  explainCard(
    front: string,
    back: string,
    style: ExplainStyle,
    apiKey: string | null,
    model: string
  ): Promise<string>;

  /** Proof-read a deck's cards; returns only the problematic ones with suggested fixes. */
  checkDeck(
    cards: { front: string; back: string }[],
    apiKey: string | null,
    model: string
  ): Promise<CardIssue[]>;

  /** Which features this provider can realistically handle (drives UI visibility). */
  readonly capabilities: AICapabilities;

  /** Default text model id used by this provider. */
  readonly defaultModel: string;

  /** True if a built-in key is shipped (so the user doesn't have to enter one). */
  readonly hasDefaultKey: boolean;

  /** Resolve the effective key: user's own or the built-in fallback. Null if neither. */
  resolveKey(userKey: string | null): string | null;
}

// --- Active provider ---------------------------------------------------------
// Change the import on this line to swap providers globally:
//   import { groqProvider as activeProvider } from './groq';
//   import { llamaProvider as activeProvider } from './llama';
import { groqProvider as activeProvider } from './groq';
// -----------------------------------------------------------------------------

export const provider: AIProvider = activeProvider;
