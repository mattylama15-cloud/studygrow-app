// Spaced repetition — a lightweight SM-2 variant.
// grade: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy

import { Flashcard } from './types';

const DAY = 86400000;

export function newCardSrs() {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now() };
}

export function review(card: Flashcard, grade: 0 | 1 | 2 | 3): Flashcard {
  let { ease, interval, reps, lapses } = card;

  if (grade === 0) {
    // forgot — reset
    reps = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 0; // due again shortly (10 min handled by due below)
    return { ...card, ease, interval, reps, lapses, due: Date.now() + 10 * 60 * 1000 };
  }

  // adjust ease
  if (grade === 1) ease = Math.max(1.3, ease - 0.15);
  if (grade === 3) ease = ease + 0.15;

  reps += 1;
  if (reps === 1) interval = grade === 1 ? 1 : grade === 3 ? 2 : 1;
  else if (reps === 2) interval = grade === 1 ? 3 : grade === 3 ? 6 : 4;
  else interval = Math.round(interval * ease * (grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1));

  interval = Math.max(1, interval);
  return { ...card, ease, interval, reps, lapses, due: Date.now() + interval * DAY };
}

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return card.due <= now;
}

// Mastery 0..1 for a single card (how well learned).
export function cardMastery(card: Flashcard): number {
  if (card.reps === 0) return 0;
  return Math.min(1, card.interval / 21); // 21 days interval ≈ "known"
}

// Deck mastery as the average card mastery (0..1).
export function deckMastery(cards: Flashcard[]): number {
  if (cards.length === 0) return 0;
  return cards.reduce((s, c) => s + cardMastery(c), 0) / cards.length;
}
