import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { Card, EmptyState, Pill, ScreenScroll, StackHeader, Button, SectionHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { findWeakDecks, findWeakCards, recentQuizMisses } from '../coach';
import { useT } from '../i18n';

export function CoachScreen() {
  const { state, clearQuizMiss, clearAllQuizMisses, addDeck, addCards } = useApp();
  const nav = useNav();
  const { t } = useT();
  const [missesSaved, setMissesSaved] = React.useState(false);

  // Chyby z kvízu → kartičky jedním tapem. Najde (nebo založí) balíček „Moje chyby"
  // a nasype do něj otázky, které jsi zkazil — SRS se pak postará o opakování.
  const saveMissesAsCards = () => {
    const misses = recentQuizMisses(state, 50);
    if (!misses.length) return;
    // Balíček hledáme podle názvu ve všech jazycích, ať se po přepnutí jazyka nezaloží druhý.
    const names = ['Moje chyby', 'My mistakes', t('coach.myMistakesDeck')];
    let deck = state.decks.find((d) => names.includes(d.title));
    if (!deck) deck = addDeck({ title: t('coach.myMistakesDeck'), emoji: '🩹', color: '#EF4444', subject: t('coach.fromQuizzes') });
    addCards(deck.id, misses.map((m) => ({ front: m.question, back: m.correctAnswer })));
    clearAllQuizMisses();
    setMissesSaved(true);
    setTimeout(() => setMissesSaved(false), 3000);
  };

  const weak = useMemo(() => findWeakDecks(state, 5), [state.cards, state.decks]);
  const weakCards = useMemo(() => findWeakCards(state, 20), [state.cards]);
  const misses = useMemo(() => recentQuizMisses(state, 20), [state.quizMisses]);

  const totalCards = state.cards.length;
  const hasAnything = weakCards.length > 0 || misses.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('coach.screenTitle')} onBack={nav.pop} />
      <ScreenScroll>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="bulb" size={28} color={colors.primary} /></View>
          <Text style={styles.heroTitle}>{t('coach.heroTitle')}</Text>
          <Text style={styles.heroSub}>
            {totalCards === 0 && misses.length === 0
              ? t('coach.heroEmpty')
              : !hasAnything
                ? t('coach.heroNoWeak')
                : misses.length
                  ? t('coach.heroSummaryMisses', { n: weakCards.length, m: misses.length })
                  : t('coach.heroSummary', { n: weakCards.length })}
          </Text>
        </View>

        {weakCards.length > 0 && (
          <Button
            title={t('coach.practiceWeak', { n: Math.min(weakCards.length, 20) })}
            icon="flash"
            onPress={() => nav.push('Study', { mode: 'weak' })}
            style={{ marginBottom: spacing.lg }}
          />
        )}

        {misses.length > 0 && (
          <>
            <View style={styles.missHeader}>
              <SectionHeader title={t('coach.quizMistakes', { n: misses.length })} />
              <Pressable onPress={clearAllQuizMisses} hitSlop={6}><Text style={styles.clearAll}>{t('coach.clearAll')}</Text></Pressable>
            </View>
            <Button
              title={t('coach.makeCards', { n: misses.length })}
              variant="secondary"
              small
              onPress={saveMissesAsCards}
              style={{ marginBottom: spacing.md }}
            />
            {missesSaved && <Text style={styles.savedOk}>{t('coach.cardsSaved')}</Text>}
            {misses.map((m) => (
              <Card key={m.id} style={{ marginBottom: 8 }}>
                <View style={styles.missRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missQ}>{m.question}</Text>
                    <Text style={styles.missA}>{t('coach.correctAnswer')} <Text style={{ fontWeight: '700', color: colors.text }}>{m.correctAnswer}</Text></Text>
                    {m.source ? <Text style={styles.missSrc}>{t('coach.fromSource', { name: m.source })}</Text> : null}
                  </View>
                  <Pressable onPress={() => clearQuizMiss(m.id)} hitSlop={6}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
                  </Pressable>
                </View>
              </Card>
            ))}
          </>
        )}

        {weak.length > 0 && (
          <>
            <SectionHeader title={t('coach.weakDecks')} />
            {weak.map((w) => (
              <Card key={w.deck.id} style={{ marginBottom: 10 }} onPress={() => nav.push('DeckDetail', { deckId: w.deck.id })}>
                <View style={styles.row}>
                  <View style={[styles.emoji, { backgroundColor: w.deck.color + '22' }]}>
                    <Text style={{ fontSize: 22 }}>{w.deck.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deckTitle} numberOfLines={1}>{w.deck.title}</Text>
                    <Text style={styles.deckMeta}>{t('coach.deckMeta', { pct: Math.round(w.mastery * 100), n: w.weakest.length })}</Text>
                  </View>
                  <Pill label={t('coach.practice')} color={colors.amber} />
                </View>
                {w.weakest.length > 0 && (
                  <View style={styles.weakList}>
                    {w.weakest.slice(0, 3).map((c) => (
                      <Text key={c.id} style={styles.weakText} numberOfLines={1}>• {c.front}</Text>
                    ))}
                    {w.weakest.length > 3 && (
                      <Text style={[styles.weakText, { color: colors.textFaint }]}>{t('coach.more', { n: w.weakest.length - 3 })}</Text>
                    )}
                  </View>
                )}
              </Card>
            ))}
          </>
        )}

        {!hasAnything && totalCards === 0 && (
          <EmptyState icon="albums-outline" title={t('coach.noData')} subtitle={t('coach.noDataSub')} />
        )}
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.lg, gap: 6, marginBottom: spacing.md },
  heroIcon: { width: 64, height: 64, borderRadius: 9999, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  deckTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  deckMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  weakList: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: 3 },
  weakText: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  missHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearAll: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700' },
  savedOk: { color: colors.primary, fontSize: font.small, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
  missRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  missQ: { fontSize: font.small, fontWeight: '700', color: colors.text, lineHeight: 19 },
  missA: { fontSize: font.tiny, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  missSrc: { fontSize: 10, color: colors.textFaint, marginTop: 4, fontWeight: '700' },
});
