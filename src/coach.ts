// "Coach" — finds the user's weak spots from flashcard history and quiz misses.
// Pure data, no UI; consumed by HomeScreen and CoachScreen.

import { Flashcard, Deck, AppState, QuizMiss } from './types';
import { isDue, deckMastery } from './srs';

/**
 * Per-card weakness score. Higher = weaker.
 * - Every lapse (forgot) hurts a lot (×2.5).
 * - Currently due (or shortly due) adds 1 point.
 * - Successful reps slowly forgive past lapses (capped).
 * - A brand new, never-reviewed card is NOT weak (score 0).
 */
export function cardWeakness(c: Flashcard, now = Date.now()): number {
  const lapses = c.lapses || 0;
  const reps = c.reps || 0;
  const overdue = isDue(c, now) ? 1 : 0;
  if (reps === 0 && lapses === 0) return 0;
  const raw = lapses * 2.5 + overdue * 1 - Math.min(reps, 6) * 0.2;
  return Math.max(0, raw);
}

export type WeakDeck = {
  deck: Deck;
  cards: Flashcard[];
  weakest: Flashcard[]; // ONLY cards with weakness > 0
  weakScore: number; // sum of weakness across the deck
  mastery: number; // 0..1
};

export function findWeakDecks(state: AppState, limit = 5): WeakDeck[] {
  const now = Date.now();
  const out: WeakDeck[] = [];
  for (const deck of state.decks) {
    const cards = state.cards.filter((c) => c.deckId === deck.id);
    if (cards.length === 0) continue;
    const scored = cards.map((c) => ({ c, w: cardWeakness(c, now) })).filter((x) => x.w > 0);
    if (scored.length === 0) continue;
    const weakScore = scored.reduce((s, x) => s + x.w, 0);
    const weakest = scored.sort((a, b) => b.w - a.w).slice(0, 8).map((x) => x.c);
    out.push({ deck, cards, weakest, weakScore, mastery: deckMastery(cards) });
  }
  return out.sort((a, b) => b.weakScore - a.weakScore).slice(0, limit);
}

/** Top N weakest cards across ALL decks. Used in a focused review session. */
export function findWeakCards(state: AppState, limit = 20): Flashcard[] {
  const now = Date.now();
  return state.cards
    .map((c) => ({ c, w: cardWeakness(c, now) }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, limit)
    .map((x) => x.c);
}

/** Total weak items = weak cards + outstanding quiz misses. */
export function weakItemCount(state: AppState): number {
  return findWeakCards(state, 999).length + (state.quizMisses?.length || 0);
}

/** Most recent quiz misses, newest first. */
export function recentQuizMisses(state: AppState, limit = 20): QuizMiss[] {
  return [...(state.quizMisses || [])].sort((a, b) => b.ts - a.ts).slice(0, limit);
}
