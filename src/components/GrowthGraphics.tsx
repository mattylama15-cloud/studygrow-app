import React from 'react';
import Svg, { Rect, Circle, Path, Polygon, Ellipse, G, Line } from 'react-native-svg';
import { PlantGraphic } from './PlantGraphic';

// Shared props for every "focus reward" visual.
export type GrowthProps = { progress: number; failed?: boolean; size?: number };

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

// ---------------- House (domek) ----------------
function HouseGraphic({ progress, failed, size = 150 }: GrowthProps) {
  const p = clamp(progress);
  const wallH = clamp((p - 0.12) / 0.43) * 38;
  const wallTop = 85 - wallH;
  const roofH = failed ? 0 : clamp((p - 0.75) / 0.15) * 20;
  const showDoor = p > 0.5;
  const showWin = p > 0.62 && wallH > 20;
  const showChim = !failed && p > 0.9;

  const wall = failed ? '#9CA3AF' : '#FCE7C8';
  const wallStroke = failed ? '#6B7280' : '#C9A874';
  const roof = failed ? '#6B7280' : '#DC2626';
  const door = failed ? '#4B5563' : '#92400E';
  const win = failed ? '#9CA3AF' : '#93C5FD';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={88} rx={34} ry={4} fill="#00000010" />
      {wallH > 1 && <Rect x={28} y={wallTop} width={44} height={wallH} fill={wall} stroke={wallStroke} strokeWidth={1} />}
      {roofH > 0 && <Polygon points={`24,${wallTop} 50,${wallTop - roofH} 76,${wallTop}`} fill={roof} />}
      {showChim && <Rect x={62} y={wallTop - 16} width={6} height={12} fill="#7F1D1D" />}
      {showChim && (
        <G opacity={0.6}>
          <Circle cx={65} cy={wallTop - 20} r={2.2} fill="#CBD5E1" />
          <Circle cx={67} cy={wallTop - 25} r={2.8} fill="#CBD5E1" />
        </G>
      )}
      {showWin && <Rect x={33} y={wallTop + 7} width={9} height={9} fill={win} stroke={wallStroke} strokeWidth={0.8} />}
      {showWin && <Rect x={58} y={wallTop + 7} width={9} height={9} fill={win} stroke={wallStroke} strokeWidth={0.8} />}
      {showDoor && <Rect x={46} y={85 - Math.min(16, wallH - 2)} width={10} height={Math.min(16, wallH - 2)} rx={1} fill={door} />}
      {failed && wallH > 4 && <Line x1={28} y1={wallTop} x2={72} y2={85} stroke="#6B7280" strokeWidth={1} strokeDasharray="3 3" />}
    </Svg>
  );
}

// ---------------- Car (auto) ----------------
function CarGraphic({ progress, failed, size = 150 }: GrowthProps) {
  const p = clamp(progress);
  const lbH = clamp((p - 0.18) / 0.4) * 16;
  const cabH = failed ? 0 : clamp((p - 0.55) / 0.25) * 14;
  const bottom = 74;
  const bodyTop = bottom - lbH;
  const cabinTop = bodyTop - cabH;
  const showWheels = p > 0.08;
  const showLight = !failed && p > 0.82;

  const body = failed ? '#9CA3AF' : '#2563EB';
  const glass = failed ? '#CBD5E1' : '#BFDBFE';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={88} rx={36} ry={4} fill="#00000010" />
      {cabH > 4 && (
        <Polygon points={`36,${bodyTop} 44,${cabinTop} 60,${cabinTop} 68,${bodyTop}`} fill={body} />
      )}
      {cabH > 7 && (
        <Polygon points={`40,${bodyTop - 2} 46,${cabinTop + 3} 58,${cabinTop + 3} 64,${bodyTop - 2}`} fill={glass} />
      )}
      {lbH > 1 && <Rect x={20} y={bodyTop} width={60} height={lbH} rx={5} fill={body} />}
      {showLight && <Circle cx={78} cy={bodyTop + 3} r={2.4} fill="#FDE047" />}
      {showWheels && (
        <G>
          <Circle cx={35} cy={80} r={8} fill={failed ? '#6B7280' : '#1F2937'} />
          <Circle cx={35} cy={80} r={3} fill="#9CA3AF" />
          <Circle cx={65} cy={80} r={8} fill={failed ? '#6B7280' : '#1F2937'} />
          <Circle cx={65} cy={80} r={3} fill="#9CA3AF" />
        </G>
      )}
    </Svg>
  );
}

// ---------------- Pea pod (hráškový lusk) ----------------
function PeaPodGraphic({ progress, failed, size = 150 }: GrowthProps) {
  const p = clamp(progress);
  const podScale = clamp((p - 0.2) / 0.32);
  const stem = failed ? '#92806B' : '#15803D';
  const podFill = failed ? '#92806B' : '#22C55E';
  const podHi = failed ? '#A8A29E' : '#4ADE80';
  const peaFill = failed ? '#78716C' : '#86EFAC';
  const peaCount = failed ? 0 : p > 0.5 ? Math.min(4, Math.floor((p - 0.5) / 0.11) + 1) : 0;
  const rx = 19 * podScale;
  const ry = 8 * podScale;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={88} rx={22} ry={3.5} fill="#00000010" />
      {p > 0.05 && <Path d="M50 87 Q44 70 50 52" stroke={stem} strokeWidth={3} fill="none" strokeLinecap="round" />}
      {!failed && p > 0.8 && (
        <G transform="rotate(-30 44 56)"><Ellipse cx={44} cy={56} rx={7} ry={3.5} fill={podHi} /></G>
      )}
      {podScale > 0.05 && (
        <G transform="rotate(-20 52 58)">
          <Ellipse cx={52} cy={58} rx={rx} ry={ry} fill={podFill} />
          <Ellipse cx={52} cy={56} rx={rx * 0.8} ry={ry * 0.45} fill={podHi} opacity={0.7} />
          {[0, 1, 2, 3].map((i) =>
            i < peaCount ? <Circle key={i} cx={52 - rx * 0.6 + (i * rx * 1.2) / 3} cy={58} r={3.4} fill={peaFill} /> : null
          )}
        </G>
      )}
    </Svg>
  );
}

// ---------------- Cake (koláč) ----------------
function CakeGraphic({ progress, failed, size = 150 }: GrowthProps) {
  const p = clamp(progress);
  const l1 = clamp((p - 0.18) / 0.32) * 16;
  const cream = failed ? 0 : clamp((p - 0.5) / 0.22) * 8;
  const baseTop = 80 - l1;
  const creamTop = baseTop - cream;
  const showFrost = !failed && p > 0.72;
  const showCherry = !failed && p > 0.95;

  const sponge = failed ? '#57534E' : '#E0A458';
  const creamC = failed ? '#A8A29E' : '#FFF7ED';
  const frost = '#F9A8D4';

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Ellipse cx={50} cy={88} rx={32} ry={4} fill="#00000010" />
      {p > 0.05 && <Ellipse cx={50} cy={82} rx={30} ry={5} fill="#CBD5E1" />}
      {l1 > 1 && <Rect x={28} y={baseTop} width={44} height={l1} rx={3} fill={sponge} />}
      {cream > 0 && <Rect x={28} y={creamTop} width={44} height={cream} rx={3} fill={creamC} />}
      {showFrost && (
        <Path d={`M28 ${creamTop} q5 6 11 0 q5 6 11 0 q5 6 11 0 q5 6 11 0 l0 4 l-44 0 z`} fill={frost} />
      )}
      {showCherry && (
        <G>
          <Path d={`M50 ${creamTop - 4} q4 -6 1 -9`} stroke="#15803D" strokeWidth={1.4} fill="none" />
          <Circle cx={50} cy={creamTop - 4} r={3.2} fill="#DC2626" />
        </G>
      )}
    </Svg>
  );
}

// ---------------- Tree (strom) — reuse existing plant ----------------
function TreeGraphic({ progress, failed, size }: GrowthProps) {
  return <PlantGraphic growth={progress} withered={failed} size={size} />;
}

// ---------------- registry + dispatcher ----------------
// `labelKey` je i18n klíč (použij ho v UI přes t()); `label` zůstává jako
// český fallback, aby se nerozbila místa, která ho zatím čtou přímo.
export type GrowthTheme = { id: string; label: string; labelKey: string; emoji: string; Component: React.ComponentType<GrowthProps> };

export const GROWTH_THEMES: GrowthTheme[] = [
  { id: 'house', label: 'Domek', labelKey: 'theme.house', emoji: '🏡', Component: HouseGraphic },
  { id: 'car', label: 'Auto', labelKey: 'theme.car', emoji: '🚗', Component: CarGraphic },
  { id: 'peapod', label: 'Hráškový lusk', labelKey: 'theme.peapod', emoji: '🌱', Component: PeaPodGraphic },
  { id: 'cake', label: 'Koláč', labelKey: 'theme.cake', emoji: '🍰', Component: CakeGraphic },
  { id: 'tree', label: 'Strom', labelKey: 'theme.tree', emoji: '🌳', Component: TreeGraphic },
];

export function getTheme(id: string | undefined): GrowthTheme {
  return GROWTH_THEMES.find((t) => t.id === id) ?? GROWTH_THEMES[0];
}

export function GrowthGraphic({ themeId, ...props }: GrowthProps & { themeId: string }) {
  const T = getTheme(themeId).Component;
  return <T {...props} />;
}
