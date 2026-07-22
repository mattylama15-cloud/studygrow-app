# Světlá verze — záloha

Appka je od teď natrvalo tmavá. Tady je uložená původní světlá paleta,
kdyby se někdy měla vrátit nebo přidat jako volba.

## Jak to vrátit

V `src/theme.ts` nahraď blok neutrálů tímto:

```ts
const ACTIVE = readSavedTheme();
const P = ACTIVE.primary;
export const isDark = !!ACTIVE.dark;   // ← řídilo se volbou motivu

const light = {
  bg: '#F4F7F5', bgAlt: '#ECF1EE', surface: '#FFFFFF', surfaceMuted: '#F8FAF9',
  text: '#0F172A', textMuted: '#64748B', textFaint: '#94A3B8',
  border: '#E2E8F0', borderStrong: '#CBD5E1',
};
const txt = ACTIVE.textColor || '#E5E7EB';
const dark = {
  bg: '#0B0B0F', bgAlt: '#15151C', surface: '#17171F', surfaceMuted: '#1F1F28',
  text: txt, textMuted: shade(txt, -0.32), textFaint: shade(txt, -0.5),
  border: '#2A2A33', borderStrong: '#3A3A46',
};
const N = isDark ? dark : light;
const soft = (c: string) => (isDark ? shade(c, -0.55) : shade(c, 0.82));
```

## Hodnoty světlé palety

| Token | Hodnota | Použití |
|---|---|---|
| bg | `#F4F7F5` | pozadí obrazovky |
| bgAlt | `#ECF1EE` | prázdné dráhy, progres |
| surface | `#FFFFFF` | karty |
| surfaceMuted | `#F8FAF9` | podklad ikon, vstupy |
| text | `#0F172A` | hlavní text |
| textMuted | `#64748B` | popisky |
| textFaint | `#94A3B8` | nejjemnější text |
| border | `#E2E8F0` | okraje karet |
| borderStrong | `#CBD5E1` | výraznější linky |

Měkký odstín akcentu ve světlém režimu: `shade(barva, 0.82)`.

## Co se ještě lišilo

- Karta série používala `gradients.primary` (světlejší přechod)
- Tab lišta měla bílé pozadí `#FFFFFF`
- Stíny: `shadowOpacity` 0.06 (karty) a 0.05 (jemné)

## Poznámka

Průběžný přechod mřížky (`tileGradient`, `gridColorAt`) je na světlosti nezávislý
— počítá se z cílové světlosti podle referenční zelené, takže funguje v obou režimech
beze změny.
