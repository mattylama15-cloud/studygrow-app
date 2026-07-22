import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, spacing, shadow } from '../theme';
import { Button, StackHeader, EmptyState } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { generateQuiz, GeneratedQuiz, AIError } from '../ai/client';
import { useT } from '../i18n';

function buildQuizFromCards(cards: { front: string; back: string }[], explainLabel: string): GeneratedQuiz[] {
  const backs = Array.from(new Set(cards.map((c) => c.back)));
  const pick = [...cards].sort(() => Math.random() - 0.5).slice(0, 10);
  return pick.map((c) => {
    const distractors = backs.filter((b) => b !== c.back).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [c.back, ...distractors].sort(() => Math.random() - 0.5);
    return {
      question: c.front,
      options,
      answerIndex: options.indexOf(c.back),
      explanation: `${explainLabel} ${c.back}`,
    };
  });
}

export function QuizScreen({ params }: { params?: Record<string, any> }) {
  const { state, addXp, recordQuizMisses } = useApp();
  const nav = useNav();
  const { t } = useT();
  const title = (params?.title as string) || t('quiz.title');
  const sourceLabel = params?.deckId
    ? state.decks.find((d) => d.id === params.deckId)?.title
    : (params?.title as string);
  // Misses collected during this quiz — flushed once when finishing.
  const missesRef = React.useRef<{ question: string; correctAnswer: string }[]>([]);

  const [questions, setQuestions] = useState<GeneratedQuiz[] | null>(null);
  const [loading, setLoading] = useState<boolean>(!!params?.source);
  const [error, setError] = useState<string | null>(null);

  const deckCards = useMemo(
    () => (params?.deckId ? state.cards.filter((c) => c.deckId === params.deckId) : []),
    []
  );

  useEffect(() => {
    if (params?.deckId) {
      setQuestions(buildQuizFromCards(deckCards, t('coach.correctAnswer')));
    } else if (params?.source) {
      (async () => {
        try {
          const q = await generateQuiz(params.source, 6, state.settings.apiKey, state.settings.model);
          if (q.length === 0) throw new AIError(t('quiz.err.empty'));
          setQuestions(q);
        } catch (e: any) {
          setError(e instanceof AIError ? e.message : t('quiz.err.create'));
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <StackHeader title={title} onBack={nav.pop} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('quiz.preparing')}</Text>
        </View>
      </View>
    );
  }

  if (error || !questions || questions.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <StackHeader title={title} onBack={nav.pop} />
        <EmptyState icon="alert-circle" title={t('quiz.err.title')} subtitle={error || t('quiz.err.tryAgain')} />
        <View style={{ padding: spacing.lg }}><Button title={t('common.back')} variant="secondary" onPress={nav.pop} /></View>
      </View>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <View style={{ flex: 1 }}>
        <StackHeader title={title} onBack={nav.pop} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 }}>
          <Text style={{ fontSize: 56 }}>{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</Text>
          <Text style={{ fontSize: font.h1, fontWeight: '800', color: colors.text }}>{score} / {questions.length}</Text>
          <Text style={{ fontSize: font.body, color: colors.textMuted }}>{t('quiz.result', { pct, xp: score * 5 })}</Text>
          <View style={{ height: spacing.lg }} />
          <Button title={t('common.done')} icon="checkmark" onPress={nav.pop} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  const q = questions[index];
  const answered = selected !== null;

  const choose = (i: number) => {
    if (answered) return;
    setSelected(i);
    const correct = i === q.answerIndex;
    if (correct) { setScore((s) => s + 1); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }
    else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      missesRef.current.push({ question: q.question, correctAnswer: q.options[q.answerIndex] });
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      addXp(score * 5);
      if (missesRef.current.length) {
        recordQuizMisses(missesRef.current.map((m) => ({ ...m, source: sourceLabel })));
      }
      setFinished(true);
    } else { setIndex((i) => i + 1); setSelected(null); }
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('quiz.question', { n: index + 1, total: questions.length })} onBack={nav.pop} />
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${(index / questions.length) * 100}%` }]} /></View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.question}>{q.question}</Text>
        <View style={{ gap: 10, marginTop: spacing.lg }}>
          {q.options.map((opt, i) => {
            const isCorrect = i === q.answerIndex;
            const isPicked = i === selected;
            let bg = colors.surface, border = colors.border, icon: any = null;
            if (answered && isCorrect) { bg = '#DCFCE7'; border = colors.success; icon = 'checkmark-circle'; }
            else if (answered && isPicked && !isCorrect) { bg = '#FEE2E2'; border = colors.danger; icon = 'close-circle'; }
            return (
              <Pressable key={i} onPress={() => choose(i)} style={[styles.option, { backgroundColor: bg, borderColor: border }]}>
                <Text style={[styles.optionText, answered && isCorrect && { color: colors.primaryDark, fontWeight: '700' }]}>{opt}</Text>
                {icon && <Ionicons name={icon} size={20} color={isCorrect ? colors.success : colors.danger} />}
              </Pressable>
            );
          })}
        </View>
        {answered && q.explanation ? (
          <View style={styles.explain}><Text style={styles.explainText}>{q.explanation}</Text></View>
        ) : null}
      </ScrollView>
      {answered && (
        <View style={{ padding: spacing.lg }}>
          <Button title={t(index + 1 >= questions.length ? 'quiz.finish' : 'quiz.nextQuestion')} icon="arrow-forward" onPress={next} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: 6, backgroundColor: colors.bgAlt, marginHorizontal: spacing.lg, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.accent, borderRadius: 3 },
  question: { fontSize: font.h3, fontWeight: '800', color: colors.text, lineHeight: 28 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, ...shadow.soft },
  optionText: { fontSize: font.body, color: colors.text, flex: 1 },
  explain: { marginTop: spacing.lg, backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: spacing.md },
  explainText: { fontSize: font.small, color: colors.text, lineHeight: 20 },
});
