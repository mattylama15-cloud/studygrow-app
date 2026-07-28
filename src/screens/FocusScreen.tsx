import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, spacing, shadow, gradients } from '../theme';
import { Button, Card, ScreenScroll, StackHeader } from '../components/ui';
import { ProgressRing } from '../components/ProgressRing';
import { GrowthGraphic, getTheme } from '../components/GrowthGraphics';
import { useApp } from '../state/AppContext';
import { useFocusTimer } from '../state/FocusTimer';
import { useNav } from '../navigation/Navigator';
import { formatClock, formatMinutes, todayKey } from '../utils';
import { useT } from '../i18n';

const GOAL_PRESETS = [30, 60, 90, 120];

const PRESETS = [15, 25, 45, 60];

type Status = 'idle' | 'running' | 'done' | 'failed';

export function FocusScreen() {
  const { state, addSession, updateSettings } = useApp();
  const { state: timer, remaining, start: startTimer, pause: pauseTimer, resume: resumeTimer,
    giveUp: giveUpTimer, reset: resetTimer } = useFocusTimer();
  const nav = useNav();
  const paused = timer.pausedLeft != null;
  const { t, lang } = useT();
  const [minutes, setMinutes] = useState(25);
  const [status, setStatus] = useState<Status>(timer.running ? 'running' : 'idle');
  const [subject] = useState('');
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const sessionStartRef = useRef<number>(0);
  // Zbývající čas v okamžiku ukončení — drží se v refu, aby ho callback
  // časovače viděl aktuální (uzávěr by jinak četl starou hodnotu).
  const leftAtEndRef = useRef<number>(0);

  // If the timer is running when we mount (e.g. user came back from another tab),
  // reflect that and keep `minutes` in sync with the running plan.
  useEffect(() => {
    if (timer.running) {
      setStatus('running');
      setMinutes(timer.minutes);
    }
  }, [timer.running, timer.minutes]);

  const total = (timer.running ? timer.minutes : minutes) * 60;
  const displayRemaining = timer.running ? remaining : total;
  const progress = !timer.running ? 0 : 1 - displayRemaining / total;
  const growth = !timer.running && status === 'idle' ? 0.02 : Math.max(0, progress);

  const start = () => {
    sessionStartRef.current = Date.now();
    setStatus('running');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    startTimer(minutes, (completed) => {
      // Počítáme ze ZBÝVAJÍCÍHO času, ne z hodin na zdi — jinak by se do
      // odpracovaných minut započítal i čas strávený na pauze.
      const leftSec = leftAtEndRef.current;
      const completedMinutes = completed ? minutes : Math.max(0, Math.round((minutes * 60 - leftSec) / 60));
      addSession({
        startedAt: sessionStartRef.current,
        plannedMinutes: minutes,
        completedMinutes,
        completed,
        plant: state.settings.focusTheme,
        subject: subject.trim() || undefined,
      });
      setStatus(completed ? 'done' : 'failed');
      Haptics.notificationAsync(completed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    });
  };

  const giveUp = () => { leftAtEndRef.current = remaining; setConfirmGiveUp(true); };
  const reset = () => { setStatus('idle'); resetTimer(); };

  const today = todayKey();
  const todaySessions = state.sessions.filter((s) => todayKey(new Date(s.startedAt)) === today);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.completedMinutes, 0);
  const dailyGoal = state.settings.dailyGoalMinutes;
  const goalPct = Math.min(100, (todayMinutes / Math.max(1, dailyGoal)) * 100);
  const theme = getTheme(state.settings.focusTheme);

  return (
    <View style={{ flex: 1 }}>
      <StackHeader
        title={t('focus.title')}
        subtitle={status === 'running' ? t('focus.subRunning') : t('focus.subIdle')}
        onBack={() => nav.setTab('Home')}
      />
      <ScreenScroll>

        {/* Timer hero */}
        <View style={styles.heroWrap}>
          <ProgressRing
            size={300}
            strokeWidth={16}
            progress={!timer.running ? 0 : progress}
            trackColor={colors.accentLine}
            colorFrom={status === 'failed' ? '#A8A29E' : paused ? colors.amber : colors.primary}
            colorTo={status === 'failed' ? '#78716C' : paused ? colors.amber : colors.primaryDark}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={{ opacity: paused ? 0.5 : 1 }}>
                <GrowthGraphic themeId={state.settings.focusTheme} progress={growth} failed={status === 'failed'} size={150} />
              </View>
              <Text style={[styles.clock, paused && { color: colors.amber }]}>{formatClock(displayRemaining)}</Text>
              <Text style={[styles.clockLabel, paused && { color: colors.amber }]}>
                {paused ? t('focus.paused') : status === 'running' ? t('focus.running') : status === 'done' ? t('focus.done') : status === 'failed' ? t('focus.failed') : t('focus.minutes', { n: minutes })}
              </Text>
            </View>
          </ProgressRing>
        </View>

        {/* Controls */}
        {status === 'idle' && !timer.running && (
          <View style={{ gap: spacing.md }}>
            <View style={styles.presetRow}>
              {PRESETS.map((p) => (
                <Pressable key={p} onPress={() => setMinutes(p)} style={[styles.preset, minutes === p && styles.presetActive]}>
                  <Text style={[styles.presetText, minutes === p && styles.presetTextActive]}>{p}m</Text>
                </Pressable>
              ))}
            </View>
            <Button title={t('focus.start')} icon="play" onPress={start} />
          </View>
        )}

        {status === 'running' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {paused ? (
              <Button title={t('focus.resume')} icon="play" onPress={resumeTimer} style={{ flex: 1 }} />
            ) : (
              <Button title={t('focus.pause')} icon="pause" variant="secondary" onPress={pauseTimer} style={{ flex: 1 }} />
            )}
            <Button title={t('focus.giveUp')} icon="close-circle" variant="danger" onPress={giveUp} style={{ flex: 1 }} />
          </View>
        )}

        {(status === 'done' || status === 'failed') && (
          <View style={{ gap: 10 }}>
            <Card style={{ alignItems: 'center', gap: 6, paddingVertical: spacing.lg }}>
              <GrowthGraphic themeId={state.settings.focusTheme} progress={status === 'done' ? 1 : 0.45} failed={status === 'failed'} size={100} />
              <Text style={styles.resultTitle}>{status === 'done' ? t('focus.greatWork') : t('focus.tryAgain')}</Text>
              <Text style={styles.resultSub}>
                {status === 'done' ? t('focus.doneSub', { what: t(theme.labelKey).toLowerCase(), n: minutes }) : t('focus.failedSub')}
              </Text>
            </Card>
            <Button title={t('focus.newSession')} icon="refresh" onPress={reset} />
          </View>
        )}

        {/* Daily goal */}
        <Card style={{ marginTop: spacing.lg }} onPress={() => setGoalOpen(true)}>
          <View style={styles.goalRow}>
            <Text style={styles.goalLabel}>{t('focus.goal')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.goalValue}>{formatMinutes(todayMinutes, lang)} / {formatMinutes(dailyGoal, lang)}</Text>
              <Ionicons name="create-outline" size={15} color={colors.textFaint} />
            </View>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${goalPct}%` }]} />
          </View>
          {goalPct >= 100 && <Text style={styles.goalDone}>{t('focus.goalDone')}</Text>}
        </Card>

        {/* Today's garden */}
        {todaySessions.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.gardenTitle}>{t('focus.todayCreations')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gardenRow}>
              {todaySessions.map((s) => (
                <View key={s.id} style={styles.gardenItem}>
                  <GrowthGraphic themeId={s.plant || state.settings.focusTheme} progress={s.completed ? 1 : 0.4} failed={!s.completed} size={56} />
                  <Text style={styles.gardenMin}>{Math.round(s.completedMinutes)}m</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScreenScroll>

      <Modal visible={confirmGiveUp} transparent animationType="fade" onRequestClose={() => setConfirmGiveUp(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmGiveUp(false)} />
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('focus.giveUpTitle')}</Text>
            <Text style={styles.confirmSub}>{t('focus.giveUpSub')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
              <Button title={t('common.continue')} variant="secondary" onPress={() => setConfirmGiveUp(false)} style={{ flex: 1 }} />
              <Button title={t('focus.giveUp')} variant="danger" onPress={() => { setConfirmGiveUp(false); giveUpTimer(); setStatus('failed'); }} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>

      <GoalModal
        visible={goalOpen}
        current={dailyGoal}
        onClose={() => setGoalOpen(false)}
        onSave={(v) => { updateSettings({ dailyGoalMinutes: v }); setGoalOpen(false); }}
      />
    </View>
  );
}

function GoalModal({ visible, current, onClose, onSave }: {
  visible: boolean; current: number; onClose: () => void; onSave: (v: number) => void;
}) {
  const { t } = useT();
  const [val, setVal] = useState(String(current));
  React.useEffect(() => { if (visible) setVal(String(current)); }, [visible, current]);
  const n = Math.max(5, Math.min(600, parseInt(val, 10) || 0));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.confirmSheet}>
          <Text style={styles.confirmTitle}>{t('focus.goalModalTitle')}</Text>
          <Text style={styles.confirmSub}>{t('focus.goalModalSub')}</Text>

          <View style={styles.goalInputRow}>
            <TextInput
              value={val}
              onChangeText={(t) => setVal(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              style={styles.goalInput}
              maxLength={4}
            />
            <Text style={styles.goalUnit}>{t('focus.minShort')}</Text>
          </View>

          <View style={styles.presetWrap}>
            {GOAL_PRESETS.map((p) => (
              <Pressable key={p} onPress={() => setVal(String(p))}
                style={[styles.presetChip, n === p && styles.presetChipActive]}>
                <Text style={[styles.presetChipText, n === p && { color: '#fff' }]}>{p}m</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('common.save')} icon="checkmark" onPress={() => onSave(n)} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerWrap: { marginBottom: spacing.sm },
  h1: { fontSize: font.h1, fontWeight: '800', color: colors.text, lineHeight: font.h1 + 8 },
  sub: { fontSize: font.small, color: colors.textMuted, marginTop: 4, lineHeight: font.small + 6 },
  heroWrap: { alignItems: 'center', marginVertical: spacing.lg },
  clock: { fontSize: 48, fontWeight: '800', color: colors.text, marginTop: 8, fontVariant: ['tabular-nums'], lineHeight: 56 },
  clockLabel: { fontSize: font.small, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  presetRow: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  presetActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  presetText: { fontWeight: '800', color: colors.textMuted, fontSize: font.body },
  presetTextActive: { color: colors.primaryDark },
  resultTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, lineHeight: font.h3 + 8 },
  resultSub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', lineHeight: font.small + 6, paddingHorizontal: spacing.md },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: { fontSize: font.body, fontWeight: '800', color: colors.text, lineHeight: font.body + 6 },
  goalValue: { fontSize: font.small, fontWeight: '700', color: colors.primary, lineHeight: font.small + 6 },
  barTrack: { height: 10, borderRadius: 6, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 6, backgroundColor: colors.primary },
  goalDone: { marginTop: 8, color: colors.primary, fontWeight: '700', fontSize: font.small, lineHeight: font.small + 6 },
  goalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  goalInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, fontSize: font.h2, fontWeight: '800', color: colors.text, textAlign: 'center' },
  goalUnit: { fontSize: font.body, fontWeight: '700', color: colors.textMuted },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  presetChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { fontWeight: '800', color: colors.textMuted, fontSize: font.small },
  gardenTitle: { fontSize: font.body, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, lineHeight: font.body + 6 },
  gardenRow: { gap: 8, paddingVertical: 4 },
  gardenItem: { alignItems: 'center', width: 64, paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  gardenMin: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '700', marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
  confirmSheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentLine },
  confirmTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, lineHeight: font.h3 + 8 },
  confirmSub: { fontSize: font.small, color: colors.textMuted, marginTop: 4, lineHeight: font.small + 6 },
});
