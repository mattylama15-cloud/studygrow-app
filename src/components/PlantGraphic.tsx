import React from 'react';
import Svg, { Path, Ellipse, Rect, Circle, G } from 'react-native-svg';

// A plant that grows with `growth` (0..1). When `withered`, it looks sad & brown.
export function PlantGraphic({ growth, withered = false, size = 150 }: { growth: number; withered?: boolean; size?: number }) {
  const g = Math.max(0, Math.min(1, growth));
  const VB = 100;
  const groundY = 80;

  const green = withered ? '#A8A29E' : '#22C55E';
  const greenDark = withered ? '#78716C' : '#15803D';
  const stem = withered ? '#92400E' : '#15803D';

  const maxStem = 46;
  const stemH = 4 + g * maxStem;
  const stemTopY = groundY - stemH;

  const leaf = (cx: number, cy: number, rot: number, scale: number, key: string) => (
    <G key={key} transform={`translate(${cx}, ${cy}) rotate(${rot}) scale(${scale})`}>
      <Ellipse cx={0} cy={0} rx={11} ry={6} fill={green} />
      <Path d={`M -10 0 Q 0 0 10 0`} stroke={greenDark} strokeWidth={0.8} fill="none" />
    </G>
  );

  const leaves: React.ReactNode[] = [];
  if (g > 0.18) leaves.push(leaf(50 - 9, groundY - stemH * 0.45, withered ? 160 : 200, 0.8, 'l1'));
  if (g > 0.34) leaves.push(leaf(50 + 9, groundY - stemH * 0.58, withered ? 20 : -20, 0.85, 'l2'));
  if (g > 0.55) leaves.push(leaf(50 - 10, groundY - stemH * 0.78, withered ? 150 : 210, 0.95, 'l3'));

  const canopyR = g > 0.62 ? 9 + (g - 0.62) * 42 : 0;
  const bloom = g >= 0.999 && !withered;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      {/* pot */}
      <Path d="M 34 80 L 66 80 L 62 96 L 38 96 Z" fill={withered ? '#9CA3AF' : '#E8825A'} />
      <Rect x={32} y={76} width={36} height={6} rx={2} fill={withered ? '#6B7280' : '#D9734B'} />
      {/* soil */}
      <Ellipse cx={50} cy={79} rx={16} ry={3.5} fill={withered ? '#57534E' : '#5B3B2E'} />

      {/* stem */}
      <Rect x={48.5} y={stemTopY} width={3} height={stemH} rx={1.5} fill={stem} />

      {leaves}

      {/* canopy / tree top */}
      {canopyR > 0 && (
        <G>
          <Circle cx={50} cy={stemTopY} r={canopyR} fill={green} opacity={0.95} />
          <Circle cx={50 - canopyR * 0.5} cy={stemTopY + 2} r={canopyR * 0.7} fill={greenDark} opacity={0.55} />
          <Circle cx={50 + canopyR * 0.5} cy={stemTopY + 1} r={canopyR * 0.65} fill={green} opacity={0.85} />
        </G>
      )}

      {/* bloom when fully grown */}
      {bloom && (
        <G>
          <Circle cx={50} cy={stemTopY - canopyR + 2} r={3.2} fill="#FBBF24" />
          <Circle cx={50} cy={stemTopY - canopyR + 2} r={1.4} fill="#F59E0B" />
        </G>
      )}

      {/* seedling sprout when tiny */}
      {g <= 0.18 && (
        <Path d={`M 50 ${groundY} q -6 -6 -2 -12`} stroke={green} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      )}
    </Svg>
  );
}
