import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { speak, stopSpeaking } from '../speech';
import { colors, font, radius, spacing, shadow } from '../theme';
import { Button, StackHeader, EmptyState } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { isDue, review } from '../srs';
import { Flashcard } from '../types';
import { findWeakCards } from '../coach';
import { explainCard, AIError, ExplainStyle, AI_CAPS } from '../ai/client';
import { useT } from '../i18n';

export function StudyScreen({ params }: { params?: Record<string, any> }) {
  const { state, updateCard, recordReviews } = useApp();
  const nav = useNav();
  const { t, lang } = useT();

  // Build the starting pool once. Then we manage a live queue:
  // "Vím" removes the card. "Nevím" pushes it to the back of the queue.
  const startPool = useMemo<Flashcard[]>(() => {
    const now = Date.now();
    let pool: Flashcard[];
    if (params?.mode === 'weak') {
      pool = findWeakCards(state, 20);
    } else if (params?.mode === 'all') {
      pool = state.cards.filter((c) => isDue(c, now));
    } else {
      const deckId = params?.deckId;
      const deckCards = state.cards.filter((c) => c.deckId === deckId);
      const dueCards = deckCards.filter((c) => isDue(c, now));
      pool = dueCards.length > 0 ? dueCards : deckCards;
    }
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 40);
  }, []);

  const [queue, setQueue] = useState<Flashcard[]>(startPool);
  const [showBack, setShowBack] = useState(false);
  const [done, setDone] = useState(0);
  const [autoVoice, setAutoVoice] = useState(false); // 🎧 hands-free: čti karty nahlas
  const [explainOpen, setExplainOpen] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;

  const currentId = queue[0]?.id;
  // Audio režim: přečti otázku pokaždé, když přijde nová karta.
  useEffect(() => {
    if (!autoVoice || !currentId) return;
    const c = queue[0];
    speak(c.front, lang);
  }, [autoVoice, currentId]);
  // Při odchodu z obrazovky přestaň mluvit.
  useEffect(() => () => { stopSpeaking(); }, []);

  if (startPool.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <StackHeader title={t('study.title')} onBack={nav.pop} />
        <EmptyState icon="checkmark-done-circle" title={t('study.nothingToReview')} subtitle={t('study.nothingSub')} />
        <View style={{ padding: spacing.lg }}><Button title={t('common.back')} variant="secondary" onPress={nav.pop} /></View>
      </View>
    );
  }

  const finished = queue.length === 0;
  const card = queue[0];

  const reveal = () => {
    setShowBack(true);
    Animated.spring(flip, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    if (autoVoice) speak(card.back, lang);
  };

  const answer = (knew: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // SRS bookkeeping: "Vím" = good (2), "Nevím" = again (0). Same logic, two buttons.
    const updated = review(card, knew ? 2 : 0);
    updateCard(updated);
    setDone((d) => d + 1);
    flip.setValue(0);
    setShowBack(false);
    setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), q[0]]));
  };

  if (finished) {
    return <FinishView count={done} t={t} onClose={() => { recordReviews(done); nav.pop(); }} onAgain={() => { recordReviews(done); nav.popToRoot(); }} />;
  }

  // Progress = how many unique cards left vs. total seen. Repeats don't reset progress.
  const remaining = queue.length;
  const total = Math.max(remaining, done + remaining);
  const progress = 1 - remaining / total;
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={`${done + 1} / ${total}`} onBack={nav.pop} right={
        <Pressable onPress={() => setAutoVoice((v) => { const n = !v; if (!n) stopSpeaking(); return n; })} hitSlop={8}
          style={[styles.voiceToggle, autoVoice && styles.voiceToggleOn]}>
          <Ionicons name={autoVoice ? 'headset' : 'headset-outline'} size={20} color={autoVoice ? colors.primaryDark : colors.textMuted} />
        </Pressable>
      } />
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>

      <View style={styles.cardArea}>
        <Pressable onPress={!showBack ? reveal : undefined} style={{ width: '100%' }}>
          <View style={styles.flashcard}>
            <Pressable onPress={() => speak(showBack ? card.back : card.front, lang)}
              hitSlop={8} style={styles.speakerBtn}>
              <Ionicons name="volume-high-outline" size={20} color={colors.textMuted} />
            </Pressable>
            {!showBack ? (
              <Animated.View style={{ opacity: frontOpacity, alignItems: 'center' }}>
                <Text style={styles.qLabel}>{t('study.question')}</Text>
                <Text style={styles.front}>{card.front}</Text>
                <View style={styles.tapHint}><Ionicons name="hand-left-outline" size={14} color={colors.textFaint} /><Text style={styles.tapHintText}>{t('study.tapForAnswer')}</Text></View>
              </Animated.View>
            ) : (
              <Animated.View style={{ opacity: backOpacity, alignItems: 'center' }}>
                <Text style={styles.qLabel}>{t('study.answer')}</Text>
                <Text style={styles.front}>{card.front}</Text>
                <View style={styles.divider} />
                <Text style={styles.back}>{card.back}</Text>
              </Animated.View>
            )}
          </View>
        </Pressable>
      </View>

      <View style={styles.footer}>
        {!showBack ? (
          <Button title={t('study.showAnswer')} icon="eye" onPress={reveal} />
        ) : (
          <>
          {AI_CAPS.explain && <Button title={t('study.explainDifferently')} variant="ghost" small onPress={() => setExplainOpen(true)} style={{ marginBottom: 8 }} />}
          <View style={styles.gradeRow}>
            <Pressable onPress={() => answer(false)} style={[styles.gradeBtn, { backgroundColor: '#EF4444' }]}>
              <Ionicons name="close" size={20} color="#fff" />
              <Text style={styles.gradeText}>{t('study.dontKnow')}</Text>
            </Pressable>
            <Pressable onPress={() => answer(true)} style={[styles.gradeBtn, { backgroundColor: '#16A34A' }]}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.gradeText}>{t('study.know')}</Text>
            </Pressable>
          </View>
          </>
        )}
      </View>

      <ExplainModal visible={explainOpen} onClose={() => setExplainOpen(false)} front={card.front} back={card.back} t={t} />
    </View>
  );
}

// "Vysvětli jinak" — AI podá stejnou kartičku 4 různými způsoby, dokud to neklikne.
function ExplainModal({ visible, onClose, front, back, t }: {
  visible: boolean; onClose: () => void; front: string; back: string; t: (k: string, v?: any) => string;
}) {
  const { state } = useApp();
  const [loading, setLoading] = useState<ExplainStyle | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (visible) { setText(null); setErr(null); setLoading(null); } }, [visible, front]);

  const run = async (style: ExplainStyle) => {
    setLoading(style); setErr(null); setText(null);
    try {
      setText(await explainCard(front, back, style, state.settings.apiKey, state.settings.model));
    } catch (e: any) {
      setErr(e instanceof AIError ? e.message : t('common.retry'));
    } finally {
      setLoading(null);
    }
  };

  const STYLES: { id: ExplainStyle; label: string }[] = [
    { id: 'simple', label: t('explain.simple') },
    { id: 'analogy', label: t('explain.analogy') },
    { id: 'story', label: t('explain.story') },
    { id: 'mnemonic', label: t('explain.mnemonic') },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.explainSheet}>
          <View style={styles.explainHandle} />
          <Text style={styles.explainTitle}>{t('explain.title')}</Text>
          <Text style={styles.explainSub} numberOfLines={2}>{front}</Text>
          <View style={styles.styleRow}>
            {STYLES.map((s) => (
              <Pressable key={s.id} onPress={() => run(s.id)} disabled={loading !== null}
                style={[styles.styleChip, loading === s.id && styles.styleChipActive]}>
                <Text style={styles.styleChipText}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingVertical: 4 }}>
            {loading !== null && <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />}
            {err && <Text style={styles.explainErr}>{err}</Text>}
            {text && <Text style={styles.explainText}>{text}</Text>}
            {!loading && !err && !text && (
              <Text style={styles.explainHint}>{t('explain.hint')}</Text>
            )}
          </ScrollView>
          <Button title={t('common.close')} variant="secondary" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
}

function FinishView({ count, onClose, onAgain, t }: { count: number; onClose: () => void; onAgain: () => void; t: (k: string, v?: any) => string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 }}>
      <Text style={{ fontSize: 56 }}>🎉</Text>
      <Text style={{ fontSize: font.h2, fontWeight: '800', color: colors.text }}>{t('study.finished')}</Text>
      <Text style={{ fontSize: font.body, color: colors.textMuted, textAlign: 'center' }}>{t('study.reviewed', { n: count, xp: count * 3 })}</Text>
      <View style={{ height: spacing.lg }} />
      <Button title={t('study.homeBtn')} icon="home" onPress={onAgain} style={{ alignSelf: 'stretch' }} />
      <Button title={t('study.backToDeck')} variant="secondary" onPress={onClose} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 6, backgroundColor: colors.bgAlt, marginHorizontal: spacing.lg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  cardArea: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  flashcard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, minHeight: 320, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  qLabel: { fontSize: font.tiny, fontWeight: '800', color: colors.textFaint, letterSpacing: 1, marginBottom: spacing.lg },
  front: { fontSize: font.h2, fontWeight: '800', color: colors.text, textAlign: 'center' },
  divider: { height: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginVertical: spacing.lg },
  back: { fontSize: font.body, color: colors.text, textAlign: 'center', lineHeight: 24 },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.xl },
  tapHintText: { fontSize: font.small, color: colors.textFaint, fontWeight: '600' },
  footer: { padding: spacing.lg },
  speakerBtn: { position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  gradeRow: { flexDirection: 'row', gap: 12 },
  gradeBtn: { flex: 1, paddingVertical: 16, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, ...shadow.soft },
  gradeText: { color: '#fff', fontWeight: '800', fontSize: font.body },
  voiceToggle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  voiceToggleOn: { backgroundColor: colors.primarySoft },
  explainSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.accentLine, padding: spacing.lg, paddingBottom: spacing.xl },
  explainHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  explainTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  explainSub: { fontSize: font.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  styleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  styleChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  styleChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  styleChipText: { fontWeight: '800', color: colors.text, fontSize: font.small },
  explainText: { fontSize: font.body, color: colors.text, lineHeight: 23 },
  explainErr: { fontSize: font.small, color: colors.danger, fontWeight: '600' },
  explainHint: { fontSize: font.small, color: colors.textFaint, textAlign: 'center', paddingVertical: spacing.md },
});
