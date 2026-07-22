// Small shared helpers.

import type { Lang } from './types';
import { translate } from './i18n';

// Formátovací helpery berou jazyk jako NEPOVINNÝ poslední parametr. Volající
// (obrazovky) ho můžou předat z useT(); bez něj se použije angličtina.
const L = (lang?: Lang): Lang => lang ?? 'en';

// Tiny non-cryptographic hash — enough to gate a client-side admin panel (soft lock).
export function simpleHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayKey(d: Date = new Date()): string {
  // Local YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(aKey + 'T00:00:00');
  const b = new Date(bKey + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function formatMinutes(mins: number, lang?: Lang): string {
  const l = L(lang);
  if (mins < 60) return translate(l, 'time.min', { n: Math.round(mins) });
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? translate(l, 'time.hourMin', { h, m }) : translate(l, 'time.hour', { h });
}

/** Krátký relativní čas: "teď", "před 5 min", "před 2 h", "před 3 dny". */
export function timeAgo(ts: number, lang?: Lang): string {
  const l = L(lang);
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 60) return translate(l, 'time.now');
  const min = Math.floor(sec / 60);
  if (min < 60) return translate(l, 'time.agoMin', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return translate(l, 'time.agoHour', { n: h });
  const d = Math.floor(h / 24);
  return translate(l, d === 1 ? 'time.agoDay1' : 'time.agoDays', { n: d });
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Level curve: smooth growth, level N needs ~ (N*120)^... keep simple.
/** Friendly "za X dní" / "dnes" / "zítra" / "před X dny". */
export function relativeDay(dateISO: string, lang?: Lang): string {
  const l = L(lang);
  const diff = daysBetween(todayKey(), dateISO);
  if (diff === 0) return translate(l, 'time.today');
  if (diff === 1) return translate(l, 'time.tomorrow');
  if (diff === -1) return translate(l, 'time.yesterday');
  if (diff > 1) return translate(l, 'time.inDays', { n: diff });
  return translate(l, 'time.daysAgo', { n: -diff });
}

/** Krátké datum: "15. 9." (cs/de), "15/9" (es) nebo "9/15" (en). */
export function shortDate(dateISO: string, lang?: Lang): string {
  const d = new Date(dateISO + 'T00:00:00');
  const day = d.getDate();
  const mon = d.getMonth() + 1;
  const l = L(lang);
  if (l === 'cs' || l === 'de') return `${day}. ${mon}.`;
  if (l === 'es') return `${day}/${mon}`;
  return `${mon}/${day}`;
}

export function levelFromXp(xp: number): { level: number; intoLevel: number; needed: number; progress: number } {
  // each level needs progressively more xp
  let level = 1;
  let remaining = xp;
  let need = 100;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need = Math.round(need * 1.35);
  }
  return { level, intoLevel: remaining, needed: need, progress: need ? remaining / need : 0 };
}
