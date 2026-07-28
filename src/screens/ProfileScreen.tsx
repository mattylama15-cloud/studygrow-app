import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, radius, spacing, shadow, gradients } from '../theme';
import { Card, ScreenScroll, StatTile, StackHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { formatMinutes, levelFromXp } from '../utils';
import { useT } from '../i18n';

export function ProfileScreen() {
  const { state } = useApp();
  const { t, lang } = useT();
  const nav = useNav();
  const { stats, settings } = state;
  const lvl = levelFromXp(stats.xp);
  const name = settings.name?.trim() || t('profile.defaultName');

  const achievements = [
    { key: 'firstStep', icon: '🌱', title: t('profile.ach.firstStep'), desc: t('profile.ach.firstStepDesc'), done: stats.plantsGrown >= 1 },
    { key: 'week', icon: '🔥', title: t('profile.ach.week'), desc: t('profile.ach.weekDesc'), done: stats.bestStreak >= 7 },
    { key: 'forest', icon: '🌳', title: t('profile.ach.forest'), desc: t('profile.ach.forestDesc'), done: stats.plantsGrown >= 10 },
    { key: 'memory', icon: '🧠', title: t('profile.ach.memory'), desc: t('profile.ach.memoryDesc'), done: stats.reviewsDone >= 100 },
    { key: 'marathon', icon: '⏳', title: t('profile.ach.marathon'), desc: t('profile.ach.marathonDesc'), done: stats.totalFocusMinutes >= 600 },
    { key: 'level5', icon: '⭐', title: t('profile.ach.level5'), desc: t('profile.ach.level5Desc'), done: lvl.level >= 5 },
  ];
  const unlocked = achievements.filter((a) => a.done).length;

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('profile.title')} onBack={() => nav.setTab('Home')} />
      <ScreenScroll>

      {/* identity card */}
      <LinearGradient colors={gradients.night as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.idCard}>
        <View style={styles.bigAvatar}><Text style={{ fontSize: 30 }}>{name[0].toUpperCase()}</Text></View>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.levelPill}>
          <Ionicons name="star" size={13} color="#FBBF24" />
          <Text style={styles.levelPillText}>{t('profile.levelPill', { level: lvl.level, xp: stats.xp })}</Text>
        </View>
        <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${lvl.progress * 100}%` }]} /></View>
        <Text style={styles.xpHint}>{t('profile.xpToNext', { n: lvl.needed - lvl.intoLevel, level: lvl.level + 1 })}</Text>
      </LinearGradient>

      {/* stats */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
        <StatTile icon="flame" value={`${stats.streak}`} label={t('profile.stat.streak')} color={colors.amber} />
        <StatTile icon="trophy" value={`${stats.bestStreak}`} label={t('profile.stat.bestStreak')} color={colors.accent} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <StatTile icon="timer" value={formatMinutes(stats.totalFocusMinutes, lang)} label={t('profile.stat.totalFocus')} color={colors.primary} />
        <StatTile icon="leaf" value={`${stats.plantsGrown}`} label={t('profile.stat.trees')} color={colors.success} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <StatTile icon="albums" value={`${state.cards.length}`} label={t('profile.stat.cards')} color={colors.blue} />
        <StatTile icon="repeat" value={`${stats.reviewsDone}`} label={t('profile.stat.reviews')} color={colors.pink} />
      </View>

      {/* achievements */}
      <Text style={styles.sectionTitle}>{t('profile.badges')} <Text style={{ color: colors.textMuted, fontWeight: '700' }}>({unlocked}/{achievements.length})</Text></Text>
      <View style={styles.achGrid}>
        {achievements.map((a) => (
          <View key={a.key} style={[styles.achCard, !a.done && styles.achLocked]}>
            <Text style={[styles.achIcon, !a.done && { opacity: 0.3 }]}>{a.icon}</Text>
            <Text style={[styles.achTitle, !a.done && { color: colors.textFaint }]}>{a.title}</Text>
            <Text style={styles.achDesc}>{a.desc}</Text>
            {a.done && <View style={styles.achCheck}><Ionicons name="checkmark" size={11} color="#fff" /></View>}
          </View>
        ))}
      </View>

      <Card style={{ marginTop: spacing.lg }} onPress={() => nav.push('Settings')}>
        <View style={styles.linkRow}>
          <Ionicons name="settings-outline" size={20} color={colors.text} />
          <Text style={styles.linkText}>{t('settings.title')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </Card>
    </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  h1: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  idCard: { alignItems: 'center', borderRadius: radius.xl, padding: spacing.xl, ...shadow.card },
  bigAvatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  name: { fontSize: font.h2, fontWeight: '800', color: '#fff' },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.sm },
  levelPillText: { color: '#fff', fontWeight: '700', fontSize: font.small },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', alignSelf: 'stretch', marginTop: spacing.md },
  xpFill: { height: 8, borderRadius: 4, backgroundColor: '#34D399' },
  xpHint: { color: 'rgba(255,255,255,0.8)', fontSize: font.tiny, marginTop: 6 },
  sectionTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achCard: { width: '47.8%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentLine, ...shadow.soft },
  achLocked: { backgroundColor: colors.surfaceMuted },
  achIcon: { fontSize: 30 },
  achTitle: { fontSize: font.body, fontWeight: '800', color: colors.text, marginTop: 6 },
  achDesc: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  achCheck: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { flex: 1, fontSize: font.body, fontWeight: '700', color: colors.text },
});
