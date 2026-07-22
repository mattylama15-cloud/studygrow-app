import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle, TextStyle, ScrollView,
  ActivityIndicator, TextInput, StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, font, shadow, gradients } from '../theme';

// ---- Screen wrapper ----
export function ScreenScroll({ children, style, contentStyle }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.bg }, style]}
      contentContainerStyle={[{ padding: spacing.lg, paddingBottom: 28 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// ---- Card ----
export function Card({ children, style, onPress }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void;
}) {
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) return <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }}>{inner}</Pressable>;
  return inner;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  VZHLED A VELIKOST TLAČÍTEK — tady si je uprav (čísla = pixely).     ║
// ║  Změň číslo → ulož (Ctrl+S) → na mobilu v Expo Go to hned uvidíš.    ║
// ╚══════════════════════════════════════════════════════════════════╝
const BTN = {
  vyska: 15,            // výška velkého tlačítka (víc = vyšší). Zkus 18 nebo 22.
  vyskaMale: 10,        // výška malého tlačítka
  sirka: 20,            // vnitřní okraj po stranách (víc = širší mezery)
  zaobleni: 14,         // kulatost rohů: 0 = hranaté, 999 = oválné „pilulka"
  velikostTextu: 16,    // velikost písma v tlačítku
  tloustkaTextu: '700' as TextStyle['fontWeight'], // '400' normální … '900' nejtučnější
};

// ---- Buttons ----
type BtnProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  gradient?: [string, string];
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
};
export function Button({ title, onPress, variant = 'primary', icon, gradient, loading, disabled, small, style }: BtnProps) {
  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };
  const pad = small ? { paddingVertical: BTN.vyskaMale, paddingHorizontal: 16 } : { paddingVertical: BTN.vyska, paddingHorizontal: BTN.sirka };
  const textColor = variant === 'secondary' || variant === 'ghost' ? colors.text : colors.onPrimary;
  const content = (
    <View style={styles.btnRow}>
      {loading ? <ActivityIndicator color={textColor} /> : icon ? <Ionicons name={icon} size={small ? 16 : 19} color={textColor} /> : null}
      <Text style={[{ color: textColor, fontWeight: BTN.tloustkaTextu, fontSize: small ? font.small : BTN.velikostTextu }]}>{title}</Text>
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable onPress={handle} disabled={disabled || loading} style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
        <LinearGradient colors={gradient ?? (gradients.primary as [string, string])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, pad, shadow.card]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }
  const bg = variant === 'danger' ? colors.dangerSoft : variant === 'ghost' ? 'transparent' : colors.surface;
  // Nebezpečná akce má červený okraj, ne barvu motivu.
  const border = variant === 'ghost' ? 'transparent' : variant === 'danger' ? colors.danger : colors.accentLine;
  return (
    <Pressable onPress={handle} disabled={disabled || loading}
      style={[styles.btn, pad, { backgroundColor: bg, borderWidth: 1, borderColor: border, opacity: disabled ? 0.5 : 1 }, style]}>
      <View style={styles.btnRow}>
        {loading ? <ActivityIndicator color={colors.text} /> : icon ? <Ionicons name={icon} size={small ? 16 : 19} color={variant === 'danger' ? colors.danger : colors.text} /> : null}
        <Text style={{ color: variant === 'danger' ? colors.danger : colors.text, fontWeight: BTN.tloustkaTextu, fontSize: small ? font.small : BTN.velikostTextu }}>{title}</Text>
      </View>
    </Pressable>
  );
}

// ---- Icon round button ----
export function IconButton({ icon, onPress, color = colors.text, bg = colors.surface, size = 20 }: {
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string; bg?: string; size?: number;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

// ---- Pill / Chip ----
export function Pill({ label, color = colors.primary, soft = true, icon }: {
  label: string; color?: string; soft?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: soft ? color + '22' : color }]}>
      {icon ? <Ionicons name={icon} size={13} color={soft ? color : '#fff'} /> : null}
      <Text style={{ color: soft ? color : '#fff', fontWeight: '700', fontSize: font.tiny }}>{label}</Text>
    </View>
  );
}

// ---- Section header ----
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

// ---- Text input ----
export function Field({ value, onChangeText, placeholder, multiline, style, autoFocus }: {
  value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; style?: StyleProp<ViewStyle>; autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      multiline={multiline}
      autoFocus={autoFocus}
      style={[styles.input, multiline && { minHeight: 110, textAlignVertical: 'top' }, style]}
    />
  );
}

// ---- Empty state ----
export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.textFaint} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

// ---- Stack screen header (with back button + language toggle) ----
export function StackHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.stackHeader}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.stackTitle} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 42, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

// ---- Stat tile ----
export function StatTile({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; color: string }) {
  return (
    <View style={[styles.statTile]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentLine, ...shadow.card },
  btn: { borderRadius: BTN.zaobleni, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  sectionAction: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.text },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 6 },
  emptyIcon: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', maxWidth: 260 },
  statTile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: 1, borderColor: colors.accentLine, ...shadow.soft },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  stackHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 6 },
  backBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  stackTitle: { flex: 1, fontSize: font.h3, fontWeight: '800', color: colors.text },
});
