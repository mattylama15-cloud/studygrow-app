import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// Shared props for every "focus reward" visual.
export type GrowthProps = { progress: number; failed?: boolean; size?: number };

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

// Každý strom má 3 fáze růstu (semenáček → mladý → dospělý) jako obrázky
// s průhledným pozadím. Fungují na všech zařízeních včetně iPhonu (na rozdíl
// od videa s alfou, které Safari neumí). Mezi fázemi plynulý crossfade podle
// `progress`, aby přechod nebyl skokový. Velikost rámce je stále stejná —
// mění se jen strom, květináč drží na místě.
type Phases = { seed: any; young: any; adult: any };

function makeTree(phases: Phases) {
  return function TreeImage({ progress, size = 150 }: GrowthProps) {
    const p = clamp(progress);

    // Průhlednost každé fáze podle progresu — sousední fáze se prolínají.
    // seed: plná do 0.25, mizí do 0.4
    // young: náběh 0.25–0.4, plná do 0.6, mizí do 0.75
    // adult: náběh 0.6–0.75, pak plná
    const seedOp = 1 - clamp((p - 0.25) / 0.15);
    const youngOp = clamp((p - 0.25) / 0.15) * (1 - clamp((p - 0.6) / 0.15));
    const adultOp = clamp((p - 0.6) / 0.15);

    const layer = (src: any, opacity: number, key: string) =>
      opacity <= 0 ? null : (
        <Image
          key={key}
          source={src}
          style={[StyleSheet.absoluteFill, { width: size, height: size, opacity, resizeMode: 'contain' }]}
        />
      );

    return (
      <View style={{ width: size, height: size }}>
        {layer(phases.seed, seedOp, 'seed')}
        {layer(phases.young, youngOp, 'young')}
        {layer(phases.adult, adultOp, 'adult')}
      </View>
    );
  };
}

const SakuraGraphic = makeTree({
  seed: require('../../assets/tree-sakura-1.png'),
  young: require('../../assets/tree-sakura-2.png'),
  adult: require('../../assets/tree-sakura-3.png'),
});
const MapleGraphic = makeTree({
  seed: require('../../assets/tree-maple-1.png'),
  young: require('../../assets/tree-maple-2.png'),
  adult: require('../../assets/tree-maple-3.png'),
});
const OakGraphic = makeTree({
  seed: require('../../assets/tree-oak-1.png'),
  young: require('../../assets/tree-oak-2.png'),
  adult: require('../../assets/tree-oak-3.png'),
});
const OliveGraphic = makeTree({
  seed: require('../../assets/tree-olive-1.png'),
  young: require('../../assets/tree-olive-2.png'),
  adult: require('../../assets/tree-olive-3.png'),
});

// ---------------- registry + dispatcher ----------------
// `labelKey` je i18n klíč (použij ho v UI přes t()); `label` zůstává jako
// český fallback, aby se nerozbila místa, která ho zatím čtou přímo.
export type GrowthTheme = { id: string; label: string; labelKey: string; emoji: string; Component: React.ComponentType<GrowthProps> };

export const GROWTH_THEMES: GrowthTheme[] = [
  { id: 'sakura', label: 'Sakura', labelKey: 'theme.sakura', emoji: '🌸', Component: SakuraGraphic },
  { id: 'maple', label: 'Javor', labelKey: 'theme.maple', emoji: '🍁', Component: MapleGraphic },
  { id: 'oak', label: 'Dub', labelKey: 'theme.oak', emoji: '🌳', Component: OakGraphic },
  { id: 'olive', label: 'Olivovník', labelKey: 'theme.olive', emoji: '🫒', Component: OliveGraphic },
];

export function getTheme(id: string | undefined): GrowthTheme {
  return GROWTH_THEMES.find((t) => t.id === id) ?? GROWTH_THEMES[0];
}

export function GrowthGraphic({ themeId, ...props }: GrowthProps & { themeId: string }) {
  const T = getTheme(themeId).Component;
  return <T {...props} />;
}
