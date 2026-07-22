// Tiny RAG (retrieval-augmented generation): when the user chats with the tutor,
// search their notes + flashcards for snippets relevant to the latest question
// and inject them as a "K dispozici máš tohle" context block. No embeddings — a
// fast token-overlap scoring keeps it on-device, deterministic, and free.

import { AppState, Note, Flashcard } from './types';
import { isDue, deckMastery } from './srs';
import { todayKey, daysBetween, levelFromXp, formatMinutes } from './utils';
import { translate } from './i18n';
import { getAiLang } from './ai/provider';

const STOP = new Set([
  'a','i','je','že','to','se','si','na','do','od','po','ve','v','o','u','ze','z','byl','byla','bylo','jsem','jsi','jsme','jste','jsou','jako','ale','jen','tak','toho','tedy','jaký','jaká','jaké','co','kdo','jak','proč','kde','kdy','tady','tam','ten','ta','te','my','vy','oni','můj','tvůj','jeho','její','svůj','the','a','an','is','are','of','to','in','on','at','for','and','or','as','it','this','that',
]);

function tokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics for matching
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function score(haystack: string, query: Set<string>): number {
  if (query.size === 0) return 0;
  const hayTokens = tokens(haystack);
  let s = 0;
  for (const t of hayTokens) if (query.has(t)) s += 1;
  // Reward dense overlap (short snippet with all keywords) over long texts that just contain one match.
  return s / Math.sqrt(hayTokens.length + 1);
}

export type ContextHit = {
  kind: 'note' | 'card';
  title: string;
  text: string;
  score: number;
};

/** Return up to `limit` relevant snippets across notes and cards. */
export function findContext(state: AppState, query: string, limit = 4): ContextHit[] {
  const q = new Set(tokens(query));
  if (q.size === 0) return [];

  const hits: ContextHit[] = [];

  for (const n of state.notes) {
    const haystack = `${n.title} ${n.body}`;
    const s = score(haystack, q);
    if (s > 0) hits.push({ kind: 'note', title: n.title || translate(getAiLang(), 'common.untitled'), text: n.body.slice(0, 600), score: s });
  }
  for (const c of state.cards) {
    const haystack = `${c.front} ${c.back}`;
    const s = score(haystack, q);
    if (s > 0.2) hits.push({ kind: 'card', title: c.front, text: c.back.slice(0, 300), score: s });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * PLNÝ přehled celé appky pro AI lektora. Dá modelu "vědomí" o všem, co uživatel
 * v appce má a dělá — balíčky, poznámky, zkoušky, úkoly, chyby z kvízů, focus,
 * streak, level. AI pak odpovídá s kontextem: "vím, že máš za 3 dny zkoušku z
 * dějepisu a nejhůř ti jde balíček Pravěk". Funguje stejně pro Groq i Llamu.
 */
export function buildFullContext(state: AppState): string {
  const today = todayKey();
  const lines: string[] = [];

  // Kdo jsem a jak na tom jsem
  const name = state.settings.name?.trim();
  const lvl = levelFromXp(state.stats.xp);
  lines.push(`UŽIVATEL: ${name || 'student'} · Level ${lvl.level} · série ${state.stats.streak} dní v kuse`);
  lines.push(`FOCUS: celkem ${formatMinutes(state.stats.totalFocusMinutes, getAiLang())} nasoustředěno · ${state.stats.reviewsDone} opakování kartiček`);

  // Balíčky + zvládnutí + kolik je k opakování
  if (state.decks.length) {
    const deckLines = state.decks.slice(0, 20).map((d) => {
      const cs = state.cards.filter((c) => c.deckId === d.id);
      const due = cs.filter((c) => isDue(c)).length;
      const m = Math.round(deckMastery(cs) * 100);
      return `- ${d.title}${d.subject ? ` (${d.subject})` : ''}: ${cs.length} kartiček, ${m}% zvládnuto, ${due} k opakování`;
    });
    lines.push(`BALÍČKY KARTIČEK (${state.decks.length}):\n${deckLines.join('\n')}`);
  } else {
    lines.push('BALÍČKY: zatím žádné.');
  }

  // Poznámky (jen názvy + počet slov, obsah řeší RAG podle dotazu)
  if (state.notes.length) {
    const noteLines = state.notes.slice(0, 15).map((n) =>
      `- ${n.title || translate(getAiLang(), 'common.untitled')} (${Math.max(1, n.body.trim().split(/\s+/).length)} slov)`);
    lines.push(`POZNÁMKY (${state.notes.length}):\n${noteLines.join('\n')}`);
  }

  // Nadcházející zkoušky s odpočtem
  const upcoming = state.exams
    .filter((e) => daysBetween(today, e.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, 8);
  if (upcoming.length) {
    const exLines = upcoming.map((e) => {
      const d = daysBetween(today, e.dateISO);
      return `- ${e.title}${e.subject ? ` (${e.subject})` : ''}: ${d === 0 ? 'DNES' : d === 1 ? 'zítra' : `za ${d} dní`} (${e.dateISO})`;
    });
    lines.push(`NADCHÁZEJÍCÍ ZKOUŠKY:\n${exLines.join('\n')}`);
  }

  // Nesplněné úkoly
  const openTasks = state.tasks
    .filter((t) => !t.done && daysBetween(today, t.dateISO) >= -3)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, 10);
  if (openTasks.length) {
    const taskLines = openTasks.map((t) => {
      const d = daysBetween(today, t.dateISO);
      const when = d < 0 ? `${-d} dní po termínu` : d === 0 ? 'dnes' : d === 1 ? 'zítra' : `za ${d} dní`;
      return `- ${t.title} (${when})`;
    });
    lines.push(`NESPLNĚNÉ ÚKOLY:\n${taskLines.join('\n')}`);
  }

  // Chyby z kvízů = slabiny
  if (state.quizMisses.length) {
    const missLines = state.quizMisses.slice(-8).map((m) => `- ${m.question} → správně: ${m.correctAnswer}`);
    lines.push(`NEDÁVNÉ CHYBY Z KVÍZŮ (na tomhle se student sekává):\n${missLines.join('\n')}`);
  }

  if (lines.length === 0) return '';
  return `\n\nTOHLE VÍŠ O STUDENTOVI A JEHO APLIKACI (použij to, když se hodí — např. připomeň blížící se zkoušku, doporuč slabý balíček, naval na chyby z kvízů; jinak ignoruj):\n\n${lines.join('\n\n')}\n\nKonec přehledu aplikace.`;
}

/** Build the system-prompt addendum the tutor sees: "K dispozici máš tohle z uživatelových materiálů". */
export function buildContextBlock(hits: ContextHit[]): string {
  if (hits.length === 0) return '';
  const lines = hits.map((h, i) => `[${i + 1}] ${h.kind === 'note' ? 'POZNÁMKA' : 'KARTIČKA'} — ${h.title}\n${h.text.trim()}`);
  return `\n\nMÁŠ K DISPOZICI TYTO ÚRYVKY Z UŽIVATELOVÝCH POZNÁMEK A KARTIČEK (použij je, pokud souvisí s otázkou; jinak ignoruj a odpověz z vlastních znalostí):\n\n${lines.join('\n\n')}\n\nKonec úryvků.`;
}
