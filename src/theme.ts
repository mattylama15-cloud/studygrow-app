// ╔══════════════════════════════════════════════════════════════════╗
// ║  VZHLED APLIKACE                                                    ║
// ║  Hlavní barvu / motiv měníš PŘÍMO V APPCE: Profil → Nastavení →      ║
// ║  „Barva appky". Tady se dají měnit rozestupy, rohy a písmo.          ║
// ╚══════════════════════════════════════════════════════════════════╝

// Posune barvu světleji (amt > 0, k bílé) nebo tmavěji (amt < 0, k černé).
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const target = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((target - r) * p + r);
  g = Math.round((target - g) * p + g);
  b = Math.round((target - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export type ThemePreset = {
  id: string;
  label: string;
  swatch: string;     // circle color shown in the picker
  primary: string;    // main accent color
  dark?: boolean;     // dark background theme
  textColor?: string; // text color for dark themes (silver / gold)
  onPrimary?: string; // text color sitting on primary buttons
};

// All selectable themes (colors + two dark variants).
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'green', label: 'Zelená', swatch: '#15803D', primary: '#15803D' },
  { id: 'teal', label: 'Tyrkysová', swatch: '#0F766E', primary: '#0F766E' },
  { id: 'cyan', label: 'Azurová', swatch: '#0E7490', primary: '#0E7490' },
  { id: 'blue', label: 'Modrá', swatch: '#1D4ED8', primary: '#1D4ED8' },
  { id: 'indigo', label: 'Indigo', swatch: '#4338CA', primary: '#4338CA' },
  { id: 'purple', label: 'Fialová', swatch: '#6D28D9', primary: '#6D28D9' },
  { id: 'pink', label: 'Růžová', swatch: '#DB2777', primary: '#DB2777' },
  { id: 'rose', label: 'Malinová', swatch: '#BE123C', primary: '#BE123C' },
  { id: 'red', label: 'Červená', swatch: '#B91C1C', primary: '#B91C1C' },
  { id: 'orange', label: 'Oranžová', swatch: '#D97706', primary: '#D97706' },
  { id: 'lime', label: 'Limetková', swatch: '#4D7C0F', primary: '#4D7C0F' },
  { id: 'slate', label: 'Břidlicová', swatch: '#334155', primary: '#334155' },
  { id: 'black-silver', label: 'Černá + stříbrná', swatch: '#0F141B', primary: '#B4BCC7', dark: true, textColor: '#D5DAE0', onPrimary: '#0B0B0F' },
  { id: 'black-gold', label: 'Černá + zlatá', swatch: '#0F141B', primary: '#C9A227', dark: true, textColor: '#E8C766', onPrimary: '#0B0B0F' },
];

function readSavedTheme(): ThemePreset {
  try {
    if (typeof localStorage !== 'undefined') {
      const id = localStorage.getItem('studygrow:theme');
      const found = THEME_PRESETS.find((p) => p.id === id);
      if (found) return found;
    }
  } catch {}
  return THEME_PRESETS[0];
}

const ACTIVE = readSavedTheme();
const P = ACTIVE.primary;

// Režim čteme při startu; přepnutí v Nastavení uloží volbu a appku přenačte
// (stejně jako změna barvy). 'system' = podle světlého/tmavého režimu telefonu.
function readSavedMode(): 'light' | 'dark' {
  let mode: string | null = null;
  try {
    if (typeof localStorage !== 'undefined') mode = localStorage.getItem('studygrow:mode');
  } catch {}
  if (mode === 'light' || mode === 'dark') return mode;
  // 'system' nebo nic → řídíme se telefonem/prohlížečem
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
  } catch {}
  return 'dark';
}

export const isDark = readSavedMode() === 'dark';

// Barvy s tmavým motivem (černá+stříbrná/zlatá) dávají smysl jen ve tmě —
// ve světlém režimu je akcent stejný, ale text na tlačítku musí být bílý.
const txt = isDark ? (ACTIVE.textColor || '#E8ECF1') : '#0F172A';

const dark = {
  bg: '#0B0B0F', bgAlt: '#1D2129', surface: '#14161C', surfaceMuted: '#1D2129',
  text: txt, textMuted: shade(txt, -0.42), textFaint: shade(txt, -0.6),
  border: '#252A33', borderStrong: '#3A3A46',
};
// Světlá paleta A — Clean & Calm (mléčně bílá s nádechem zelené).
const light = {
  bg: '#F4F7F5', bgAlt: '#ECF1EE', surface: '#FFFFFF', surfaceMuted: '#F8FAF9',
  text: '#0F172A', textMuted: '#64748B', textFaint: '#94A3B8',
  border: '#E2E8F0', borderStrong: '#CBD5E1',
};
const N = isDark ? dark : light;
// Měkký nádech akcentu: ve tmě ztmavíme, ve světle naopak hodně zesvětlíme.
const soft = (c: string) => (isDark ? shade(c, -0.55) : shade(c, 0.85));

export const colors = {
  bg: N.bg,
  bgAlt: N.bgAlt,
  surface: N.surface,
  surfaceMuted: N.surfaceMuted,

  primary: P,
  primaryDark: shade(P, -0.22),
  primarySoft: soft(P),

  accent: P,            // accent follows the chosen color (more cohesive coloring)
  accentSoft: soft(P),
  pink: '#EC4899',
  pinkSoft: isDark ? '#3A2030' : '#FCE7F3',
  amber: '#F59E0B',
  amberSoft: isDark ? '#3A2E12' : '#FEF3C7',
  blue: '#2563EB',
  blueSoft: isDark ? '#15233F' : '#DBEAFE',

  text: N.text,
  textMuted: N.textMuted,
  textFaint: N.textFaint,
  onPrimary: ACTIVE.onPrimary || '#FFFFFF',

  border: N.border,
  borderStrong: N.borderStrong,
  // Subtle gold/silver hairline for card & button borders in dark mode (premium look).
  accentLine: isDark ? shade(P, -0.42) : '#E2E8F0',
  success: P,
  danger: '#EF4444',
  dangerSoft: isDark ? '#3A1A1A' : '#FEE2E2',
  star: '#FBBF24',

  shadow: '#0F172A',
};

// On web/PWA, paint the page background to match the theme (no white edges / status-bar blends in).
try {
  if (typeof document !== 'undefined') {
    document.documentElement.style.backgroundColor = colors.bg;
    if (document.body) document.body.style.backgroundColor = colors.bg;
  }
} catch {}

// Gradients all derive from the chosen color so the whole app takes its hue.
export const gradients = {
  primary: [shade(P, 0.08), shade(P, -0.16)],
  forest: [shade(P, 0.22), shade(P, -0.04)],
  ai: [shade(P, 0.02), shade(P, -0.3)],
  ocean: [shade(P, 0.28), shade(P, -0.02)],
  sunset: [shade(P, 0.14), shade(P, -0.22)],
  night: isDark ? ['#1C1C24', '#0B0B0F'] : ['#1E293B', '#0F172A'],
  pinkPurple: [shade(P, 0.18), shade(P, -0.18)],
};

// ── Průběžný přechod přes mřížku dlaždic ────────────────────────────────
// Mřížka rychlých akcí je jeden diagonální přechod: vlevo nahoře nejsvětlejší,
// vpravo dole nejtmavší. Každá dlaždice vykreslí svůj výřez podle pozice, takže
// sousední hrany na sebe navazují.
//
// Přechod se řídí CÍLOVOU světlostí podle referenční zelené, ne posunem vůči
// vlastní barvě — jinak by tmavé barvy (fialová, indigo, břidlicová) působily
// ploše, protože stejný posun je u nich opticky menší než u světlé zelené.

const GRID_LIGHT = 0.30;   // nejsvětlejší roh
const GRID_DARK = -0.24;   // nejtmavší roh
const GRID_REF = '#15803D';
export const GRID_COLS = 2;
export const GRID_ROWS = 4;

// Vnímaná světlost barvy 0..255.
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

// Srovná `color` na stejnou světlost jako `target` — zachová odstín, změní jas.
function matchLuminance(color: string, target: string): string {
  const want = luminance(target);
  let lo = -0.9, hi = 0.9;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(shade(color, mid)) < want) lo = mid; else hi = mid;
  }
  return shade(color, (lo + hi) / 2);
}

/** Barva v bodě (x, y) mřížky. Souřadnice jsou v jednotkách dlaždic. */
export function gridColorAt(x: number, y: number, base: string = P): string {
  const p = (x / GRID_COLS + y / GRID_ROWS) / 2;
  const target = shade(GRID_REF, GRID_LIGHT + (GRID_DARK - GRID_LIGHT) * p);
  return matchLuminance(base, target);
}

/**
 * Gradient jedné dlaždice mřížky.
 * @param col sloupec (0 vlevo)
 * @param row řádek (0 nahoře)
 * @param full dlaždice přes celou šířku
 * @param ownColor vlastní barva dlaždice (např. jantarová u Opakování)
 */
export function tileGradient(col: number, row: number, full = false, ownColor?: string): [string, string] {
  const x0 = full ? 0 : col;
  const x1 = full ? GRID_COLS : col + 1;
  const c = ownColor || P;
  const from = gridColorAt(x0, row, c);
  const to = gridColorAt(x1, row + 1, c);
  // Jantarová je vůči zelené opticky těžší, proto ji zesvětlíme.
  const LIFT = 0.16;
  return ownColor ? [shade(from, LIFT), shade(to, LIFT)] : [from, to];
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };
export const font = { h1: 30, h2: 24, h3: 19, body: 16, small: 14, tiny: 12 };

export const shadow = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.25 : 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
};

export const deckColors = [
  '#16A34A', '#2563EB', '#7C3AED', '#EC4899',
  '#F59E0B', '#0891B2', '#DC2626', '#4F46E5',
];

export const deckEmojis = ['📚', '🧮', '🧪', '🧬', '🌍', '🗣️', '💻', '🎨', '⚖️', '🏛️', '🩺', '📐'];
