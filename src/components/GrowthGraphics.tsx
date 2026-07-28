import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Shared props for every "focus reward" visual.
export type GrowthProps = { progress: number; failed?: boolean; size?: number };

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

// Každý strom je krátké video růstu (semenáček → dospělý). Nepřehrává se samo —
// jeho pozice v čase se řídí `progress` (0→1) z focusu, takže strom "roste"
// přesně podle toho, jak dlouho focus běží. Na konci focusu je strom dospělý.
function makeTree(source: any) {
  return function TreeVideo({ progress, size = 150 }: GrowthProps) {
    const player = useVideoPlayer(source, (p) => {
      p.loop = false;
      p.muted = true;
      p.pause();
    });

    useEffect(() => {
      const dur = player.duration;
      if (!dur || isNaN(dur)) return;
      // pozice ve videu = kolik procent focusu uplynulo
      player.currentTime = clamp(progress) * dur;
    }, [progress, player]);

    return (
      <View style={{ width: size, height: size }}>
        <VideoView
          player={player}
          style={{ width: size, height: size }}
          contentFit="contain"
          nativeControls={false}
        />
      </View>
    );
  };
}

const SakuraGraphic = makeTree(require('../../assets/tree-sakura.webm'));
const MapleGraphic = makeTree(require('../../assets/tree-maple.webm'));
const OakGraphic = makeTree(require('../../assets/tree-oak.webm'));
const OliveGraphic = makeTree(require('../../assets/tree-olive.webm'));

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
