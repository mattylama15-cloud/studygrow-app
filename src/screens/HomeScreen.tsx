import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, radius, spacing, shadow, gradients, isDark, tileGradient } from '../theme';
import { Button, ScreenScroll } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { isDue } from '../srs';
import { todayKey, formatMinutes, levelFromXp, daysBetween, relativeDay, shortDate } from '../utils';
import { findWeakCards } from '../coach';
import { useT } from '../i18n';
import { LangToggle } from '../components/LangToggle';
import { FocusStrip } from '../components/FocusStrip';

// Datum v hlavičce — den v týdnu a datum. Střízlivé, bez hravých hlášek.
const DAYS_CS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const MONTHS_CS = ['ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const DAYS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function dateLine(lang: string): string {
  const d = new Date();
  if (lang === 'cs') return `${DAYS_CS[d.getDay()]}, ${d.getDate()}. ${MONTHS_CS[d.getMonth()]}`;
  if (lang === 'de') return `${DAYS_DE[d.getDay()]}, ${d.getDate()}. ${MONTHS_DE[d.getMonth()]}`;
  // Ve španělštině se den v týdnu i měsíc píší malým písmenem.
  if (lang === 'es') return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
  return `${DAYS_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
}

export function HomeScreen() {
  const { state, updateSettings } = useApp();
  const nav = useNav();
  const { t, lang } = useT();
  const { stats, settings } = state;
  const [showGoal, setShowGoal] = useState(false);

  const now = Date.now();
  const totalDue = state.cards.filter((c) => isDue(c, now)).length;
  const today = todayKey();
  const todayMinutes = state.sessions
    .filter((s) => todayKey(new Date(s.startedAt)) === today)
    .reduce((sum, s) => sum + s.completedMinutes, 0);
  const lvl = levelFromXp(stats.xp);
  const name = settings.name?.trim();

  // Streak warning: user has a streak going AND hasn't been active today yet
  // — without something today the streak resets. Shown only when streak >= 2.
  const streakAtRisk = stats.streak >= 2 && stats.lastActiveDay !== today;

  // Nearest upcoming exam (today or future), and current weakness count.
  const nextExam = state.exams
    .filter((e) => daysBetween(today, e.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0];
  const weakCount = findWeakCards(state, 99).length;

  return (
    <View style={{ flex: 1 }}>
    <ScreenScroll>
      {/* hlavička: vlevo jméno a datum, vpravo jazykové kolečko */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting} numberOfLines={1}>{name || 'StudyGrow'}</Text>
          <Text style={styles.dateLine}>{dateLine(lang)}</Text>
        </View>
        <LangToggle />
      </View>

      <FocusStrip />

      {streakAtRisk && (
        <Pressable onPress={() => nav.setTab('Focus')} style={styles.streakWarn}>
          <Ionicons name="alert-circle" size={20} color={colors.amber} />
          <Text style={styles.streakWarnText}>{t('home.streakRisk', { n: stats.streak })}</Text>
        </Pressable>
      )}

      {/* streak hero */}
      {/* Série používá stejný přechod jako mřížka pod ní — navazují na sebe. */}
      <LinearGradient colors={tileGradient(0, 0, true)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.streakCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.streakNum}>{stats.streak} {stats.streak === 1 ? t('home.streak.day') : stats.streak >= 5 ? t('home.streak.days5') : t('home.streak.days2')} 🔥</Text>
          <Text style={styles.streakLabel}>{t('home.streak.label')}</Text>
          <View style={styles.levelRow}>
            <Text style={styles.levelText}>{t('home.level')} {lvl.level}</Text>
            <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${lvl.progress * 100}%` }]} /></View>
          </View>
        </View>
      </LinearGradient>

      {nextExam && (
        <Pressable onPress={() => nav.push('Calendar')} style={styles.examCard}>
          <View style={[styles.examColor, { backgroundColor: nextExam.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.examTitle} numberOfLines={1}>📅 {nextExam.title}</Text>
            <Text style={styles.examSub}>{shortDate(nextExam.dateISO, lang)} · {relativeDay(nextExam.dateISO, lang)}</Text>
          </View>
          <View style={styles.examDays}>
            <Text style={styles.examDaysNum}>{daysBetween(today, nextExam.dateISO)}</Text>
            <Text style={styles.examDaysLbl}>{t('home.exam.days')}</Text>
          </View>
        </Pressable>
      )}

      {/* quick actions */}
      <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
      {/* Mřížka je jeden průběžný přechod — každá dlaždice zná svou pozici. */}
      <View style={styles.actionsGrid}>
        <ActionCard col={0} row={0} icon="timer" title={t('action.focus.title')} subtitle={t('action.focus.sub')} onPress={() => nav.setTab('Focus')} />
        <ActionCard col={1} row={0} icon="help-circle" title={t('action.quiz.title')} subtitle={t('action.quiz.sub')} onPress={() => nav.push('QuizSetup')} />
        <ActionCard col={0} row={1} icon="albums" title={t('action.decks.title')} subtitle={t('action.decks.sub', { n: totalDue })} onPress={() => nav.setTab('Decks')} />
        <ActionCard col={1} row={1} icon="document-text" title={t('action.notes.title')} subtitle={t('action.notes.sub', { n: state.notes.length })} onPress={() => nav.push('Notes')} />
        <ActionCard col={0} row={2} icon="calendar" title={t('action.calendar.title')} subtitle={nextExam ? t('action.calendar.subExam', { n: daysBetween(today, nextExam.dateISO) }) : t('action.calendar.sub')} onPress={() => nav.push('Calendar')} />
        <ActionCard col={1} row={2} ownColor="#D97706" icon="refresh-circle" title={t('action.coach.title')} subtitle={weakCount > 0 ? t('action.coach.sub', { n: weakCount }) : t('action.coach.subEmpty')} onPress={() => nav.push('Coach')} />
        <ActionCard col={0} row={3} full icon="people" title={t('action.together.title')} subtitle={t('action.together.sub')} onPress={() => nav.push('StudyTogether')} />
      </View>

    </ScreenScroll>
    </View>
  );
}

function GoalModal({ visible, current, onClose, onSave }: {
  visible: boolean; current: number; onClose: () => void; onSave: (v: number) => void;
}) {
  const { t } = useT();
  const [val, setVal] = useState(String(current));
  React.useEffect(() => { if (visible) setVal(String(current)); }, [visible, current]);
  const num = Math.max(1, Math.min(3600, parseInt(val || '0', 10) || 0));
  const presets = [15, 30, 45, 60, 90, 120, 180, 240];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('home.goalTitle')}</Text>
          <Text style={styles.sheetSub}>{t('home.goalSub')}</Text>
          <View style={styles.goalInputRow}>
            <TextInput value={val} onChangeText={(t) => setVal(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad"
              maxLength={4} style={styles.goalInput} />
            <Text style={styles.goalUnit}>{t('home.goalUnit')}</Text>
          </View>
          <View style={styles.presetWrap}>
            {presets.map((p) => (
              <Pressable key={p} onPress={() => setVal(String(p))} style={[styles.presetChip, num === p && styles.presetChipActive]}>
                <Text style={[styles.presetChipText, num === p && { color: '#fff' }]}>{p >= 60 ? `${p / 60}h` : `${p}m`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('common.save')} icon="checkmark" onPress={() => onSave(num)} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ActionCard({ icon, title, subtitle, onPress, full, col, row, ownColor }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void;
  full?: boolean; col: number; row: number; ownColor?: string;
}) {
  const wrapStyle = full ? styles.actionWrapFull : styles.actionWrap;
  const grad = tileGradient(col, row, full, ownColor);
  return (
    <Pressable onPress={onPress} style={wrapStyle}>
      <LinearGradient colors={grad as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
        <Ionicons name={icon} size={26} color="#fff" />
        <View style={styles.actionTextWrap}>
          <Text style={styles.actionTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.actionSub} numberOfLines={1}>{subtitle}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md },
  greeting: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  dateLine: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  subGreeting: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  avatar: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  streakCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  streakNum: { fontSize: font.h2, fontWeight: '800', color: '#fff' },
  streakLabel: { fontSize: font.small, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  levelText: { fontSize: font.tiny, fontWeight: '800', color: '#fff' },
  xpTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  xpFill: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  sectionTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionWrap: { width: '47.8%' },
  actionWrapFull: { width: '100%' },
  action: { borderRadius: radius.lg, padding: spacing.lg, height: 116, justifyContent: 'space-between' },
  actionDark: { borderWidth: 1.5, borderColor: colors.primary },
  actionTextWrap: { marginTop: 'auto' },
  actionTitle: { fontSize: font.body, fontWeight: '800', color: '#fff' },
  actionSub: { fontSize: font.tiny, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  dueDeckRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dueEmoji: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dueDeckTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  dueDeckMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: { fontSize: font.body, fontWeight: '700', color: colors.text },
  goalValue: { fontSize: font.small, fontWeight: '700', color: colors.primary },
  barTrack: { height: 10, borderRadius: 6, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 6, backgroundColor: colors.primary },
  goalDone: { fontSize: font.small, color: colors.primary, fontWeight: '700', marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  goalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: font.h2, fontWeight: '800', color: colors.text, textAlign: 'center' },
  goalUnit: { fontSize: font.body, fontWeight: '700', color: colors.textMuted },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  presetChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { fontWeight: '800', color: colors.textMuted, fontSize: font.small },
  streakWarn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberSoft, borderColor: colors.amber, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  streakWarnText: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '700', lineHeight: 19 },
  examCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, ...shadow.soft },
  examColor: { width: 6, height: 36, borderRadius: 3 },
  examTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  examSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  examDays: { alignItems: 'center', minWidth: 48 },
  examDaysNum: { fontSize: font.h2, fontWeight: '800', color: colors.primary, lineHeight: font.h2 + 2 },
  examDaysLbl: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  coachCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.amberSoft, borderColor: colors.amber, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  coachText: { flex: 1, color: colors.text, fontSize: font.small, fontWeight: '700' },
});
