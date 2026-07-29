import React, { useEffect, useRef } from 'react';
import { View, Image, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// Shared props for every "focus reward" visual.
export type GrowthProps = {
  progress: number;
  failed?: boolean;
  size?: number;
  running?: boolean;
  durationSec?: number;
};

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

// Video růstu (plynulé, průhledné pozadí) — během focusu se přehrává a jeho
// pozice se řídí `progress` (0→1), takže roste plynule po malých kouscích jako
// video. Ve stavu KLIDU (idle / výsledek) video na webu neseekuje spolehlivě,
// tak tam ukážeme statický snímek správné fáze.
const VIDEOS: Record<string, any> = {
  sakura: require('../../assets/tree-sakura.webm'),
  maple: require('../../assets/tree-maple.webm'),
  oak: require('../../assets/tree-oak.webm'),
  olive: require('../../assets/tree-olive.webm'),
};

// Statické snímky (semenáček … dospělý) pro idle a výsledek.
const STILLS: Record<string, any[]> = {
  sakura: [require('../../assets/tree-sakura-000.png'), require('../../assets/tree-sakura-030.png'), require('../../assets/tree-sakura-060.png'), require('../../assets/tree-sakura-090.png'), require('../../assets/tree-sakura-120.png')],
  maple: [require('../../assets/tree-maple-000.png'), require('../../assets/tree-maple-030.png'), require('../../assets/tree-maple-060.png'), require('../../assets/tree-maple-090.png'), require('../../assets/tree-maple-120.png')],
  oak: [require('../../assets/tree-oak-000.png'), require('../../assets/tree-oak-030.png'), require('../../assets/tree-oak-060.png'), require('../../assets/tree-oak-090.png'), require('../../assets/tree-oak-120.png')],
  olive: [require('../../assets/tree-olive-000.png'), require('../../assets/tree-olive-030.png'), require('../../assets/tree-olive-060.png'), require('../../assets/tree-olive-090.png'), require('../../assets/tree-olive-120.png')],
};

function stillFor(themeId: string, progress: number) {
  const frames = STILLS[themeId] ?? STILLS.sakura;
  return frames[Math.round(clamp(progress) * (frames.length - 1))];
}

// WEB video: přímý HTML <video> element, currentTime řízen progresem.
function WebVideo({ src, progress, size }: { src: string; progress: number; size: number }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const apply = () => {
      if (v.duration && !isNaN(v.duration)) v.currentTime = clamp(progress) * v.duration;
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener('loadedmetadata', apply, { once: true });
  }, [progress]);
  return (
    // @ts-ignore web element
    <video ref={ref} src={src} muted playsInline preload="auto"
      style={{ width: size, height: size, objectFit: 'contain' }} />
  );
}

// NATIV video: expo-video.
function NativeVideo({ source, progress, size }: { source: any; progress: number; size: number }) {
  const player = useVideoPlayer(source, (p) => { p.loop = false; p.muted = true; p.pause(); });
  useEffect(() => {
    const dur = player.duration;
    if (!dur || isNaN(dur)) return;
    try { player.currentTime = clamp(progress) * dur; } catch (e) {}
  }, [progress, player]);
  return <VideoView player={player} style={{ width: size, height: size }} contentFit="contain" nativeControls={false} />;
}

// ---------------- registry + dispatcher ----------------
export type GrowthTheme = { id: string; label: string; labelKey: string; emoji: string };

export const GROWTH_THEMES: GrowthTheme[] = [
  { id: 'sakura', label: 'Sakura', labelKey: 'theme.sakura', emoji: '🌸' },
  { id: 'maple', label: 'Javor', labelKey: 'theme.maple', emoji: '🍁' },
  { id: 'oak', label: 'Dub', labelKey: 'theme.oak', emoji: '🌳' },
  { id: 'olive', label: 'Olivovník', labelKey: 'theme.olive', emoji: '🫒' },
];

export function getTheme(id: string | undefined): GrowthTheme {
  return GROWTH_THEMES.find((t) => t.id === id) ?? GROWTH_THEMES[0];
}

export function GrowthGraphic({ themeId, progress, size = 150, running }: GrowthProps & { themeId: string }) {
  const id = getTheme(themeId).id;
  // Video jen když focus běží (plynulý růst). Jinak statický snímek.
  if (running) {
    return (
      <View style={{ width: size, height: size }}>
        {Platform.OS === 'web'
          ? <WebVideo src={VIDEOS[id]} progress={progress} size={size} />
          : <NativeVideo source={VIDEOS[id]} progress={progress} size={size} />}
      </View>
    );
  }
  return <Image source={stillFor(id, progress)} style={{ width: size, height: size, resizeMode: 'contain' }} fadeDuration={0} />;
}

// Statický snímek výsledku — strom v té fázi, kam dorostl.
export function GrowthStill({ themeId, progress, size = 100 }: { themeId: string; progress: number; size?: number }) {
  return <Image source={stillFor(getTheme(themeId).id, progress)} style={{ width: size, height: size, resizeMode: 'contain' }} />;
}
