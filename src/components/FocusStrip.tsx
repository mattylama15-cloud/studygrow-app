import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { useFocusTimer } from '../state/FocusTimer';
import { useNav } from '../navigation/Navigator';
import { formatClock } from '../utils';
import { useT } from '../i18n';

// Běžící focus je vidět i mimo obrazovku Focus — jinak se na něj zapomene.
// Za pauzy zežloutne a nabídne pokračování rovnou, bez přepínání tabu.
export function FocusStrip() {
  const { state: timer, remaining, resume } = useFocusTimer();
  const nav = useNav();
  const { t } = useT();

  if (!timer.running) return null;
  const paused = timer.pausedLeft != null;

  return (
    <Pressable onPress={() => nav.setTab('Focus')} style={[styles.wrap, paused && styles.wrapPaused]}>
      <View style={[styles.dot, paused && styles.dotPaused]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.time, paused && styles.timePaused]}>
          {t('focus.stripLeft', { time: formatClock(remaining) })}
        </Text>
        <Text style={styles.label}>{paused ? t('focus.stripPaused') : t('focus.stripRunning')}</Text>
      </View>
      {paused ? (
        <Pressable
          onPress={resume}
          hitSlop={8}
          style={[styles.action, styles.actionPaused]}
          accessibilityRole="button"
        >
          <Ionicons name="play" size={13} color={colors.amber} />
          <Text style={[styles.actionText, { color: colors.amber }]}>{t('focus.resume')}</Text>
        </Pressable>
      ) : (
        <View style={styles.action}>
          <Text style={styles.actionText}>{t('focus.stripOpen')}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  wrapPaused: { borderColor: colors.amber },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dotPaused: { backgroundColor: colors.amber },
  time: { fontSize: font.small, fontWeight: '700', color: colors.text },
  timePaused: { color: colors.amber },
  label: { fontSize: font.tiny, color: colors.textFaint, marginTop: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  actionPaused: { borderColor: colors.amber },
  actionText: { fontSize: font.tiny, fontWeight: '700', color: colors.primary },
});
