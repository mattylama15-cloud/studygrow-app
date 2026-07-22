import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing, shadow, deckColors, deckEmojis } from '../theme';
import { Button, Card, Field, Pill, ScreenScroll, SectionHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { deckMastery, isDue } from '../srs';
import { useT } from '../i18n';
import { FocusStrip } from '../components/FocusStrip';

export function DecksScreen() {
  const { state, addDeck } = useApp();
  const nav = useNav();
  const { t } = useT();
  const [showCreate, setShowCreate] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const now = Date.now();
  const totalDue = state.cards.filter((c) => isDue(c, now)).length;

  // Předměty, které appka zakládá sama, jsou uložené v jazyce platném při
  // vzniku balíčku. Při zobrazení je přeložíme do aktuálního jazyka; filtruje
  // se dál podle uložené hodnoty, takže starší balíčky zůstanou spárované.
  const showSubject = (s: string) => {
    const known: Record<string, string> = {
      'Poznámky': 'notes.title', 'Notes': 'notes.title',
      'Z kvízů': 'coach.fromQuizzes', 'From quizzes': 'coach.fromQuizzes',
    };
    return known[s] ? t(known[s]) : s;
  };

  // Unique subjects across all decks, sorted alphabetically.
  const subjects = Array.from(new Set(state.decks.map((d) => d.subject).filter((s): s is string => !!s && s.trim().length > 0))).sort();
  const filteredDecks = subjectFilter ? state.decks.filter((d) => d.subject === subjectFilter) : state.decks;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>{t('decks.title')}</Text>
            <Text style={styles.sub}>{t('decks.summary', { d: state.decks.length, c: state.cards.length })}</Text>
          </View>
        </View>

        <FocusStrip />

        {/* Due summary — only shown when something is actually due */}
        {totalDue > 0 && (
          <Pressable onPress={() => nav.push('Study', { mode: 'all' })}>
            <View style={styles.dueCard}>
              <View style={styles.dueIcon}><Ionicons name="flash" size={22} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dueTitle}>{t('decks.dueTitle', { n: totalDue })}</Text>
                <Text style={styles.dueSub}>{t('decks.dueSub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </View>
          </Pressable>
        )}

        <SectionHeader title={t('decks.yourDecks')} />

        {subjects.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable onPress={() => setSubjectFilter(null)} style={[styles.chip, !subjectFilter && styles.chipActive]}>
              <Text style={[styles.chipText, !subjectFilter && styles.chipTextActive]}>{t('decks.all')}</Text>
            </Pressable>
            {subjects.map((s) => (
              <Pressable key={s} onPress={() => setSubjectFilter(s === subjectFilter ? null : s)}
                style={[styles.chip, subjectFilter === s && styles.chipActive]}>
                <Text style={[styles.chipText, subjectFilter === s && styles.chipTextActive]}>{showSubject(s)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {filteredDecks.map((deck) => {
          const cards = state.cards.filter((c) => c.deckId === deck.id);
          const due = cards.filter((c) => isDue(c, now)).length;
          const mastery = Math.round(deckMastery(cards) * 100);
          return (
            <Card key={deck.id} style={{ marginBottom: 10 }} onPress={() => nav.push('DeckDetail', { deckId: deck.id })}>
              <View style={styles.deckRow}>
                <View style={[styles.deckEmoji, { backgroundColor: deck.color + '22' }]}>
                  <Text style={{ fontSize: 24 }}>{deck.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deckTitle} numberOfLines={1}>{deck.title}</Text>
                  <Text style={styles.deckMeta}>{t('decks.cardCount', { n: cards.length })}{deck.subject ? ` · ${showSubject(deck.subject)}` : ''}</Text>
                  <View style={styles.masteryTrack}>
                    <View style={[styles.masteryFill, { width: `${mastery}%`, backgroundColor: deck.color }]} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {due > 0 ? <Pill label={t('decks.dueToday', { n: due })} color={colors.amber} /> : <Pill label={`${mastery}%`} color={deck.color} />}
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </View>
            </Card>
          );
        })}

        <Button title={t('decks.newDeck')} icon="add" variant="secondary" onPress={() => setShowCreate(true)} style={{ marginTop: 6 }} />
      </ScreenScroll>

      <CreateDeckModal visible={showCreate} onClose={() => setShowCreate(false)} onCreate={(d) => { const deck = addDeck(d); setShowCreate(false); nav.push('DeckDetail', { deckId: deck.id }); }} />
    </View>
  );
}

function CreateDeckModal({ visible, onClose, onCreate }: {
  visible: boolean; onClose: () => void; onCreate: (d: { title: string; subject?: string; emoji: string; color: string }) => void;
}) {
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [emoji, setEmoji] = useState(deckEmojis[0]);
  const [color, setColor] = useState(deckColors[0]);

  const create = () => {
    if (!title.trim()) return;
    onCreate({ title: title.trim(), subject: subject.trim() || undefined, emoji, color });
    setTitle(''); setSubject(''); setEmoji(deckEmojis[0]); setColor(deckColors[0]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('decks.newDeck')}</Text>
          <Field value={title} onChangeText={setTitle} placeholder={t('decks.namePlaceholder')} autoFocus />
          <View style={{ height: 10 }} />
          <Field value={subject} onChangeText={setSubject} placeholder={t('decks.subjectPlaceholder')} />

          <Text style={styles.pickLabel}>{t('decks.icon')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {deckEmojis.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.emojiPick, emoji === e && { borderColor: color, backgroundColor: color + '18' }]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.pickLabel}>{t('decks.color')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {deckColors.map((c) => (
              <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorPick, { backgroundColor: c }, color === c && styles.colorPickActive]} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('decks.create')} icon="checkmark" onPress={create} disabled={!title.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  h1: { fontSize: font.h1, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  dueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  dueIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  dueTitle: { color: '#fff', fontSize: font.body, fontWeight: '800' },
  dueSub: { color: 'rgba(255,255,255,0.85)', fontSize: font.small, marginTop: 1 },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deckEmoji: { width: 50, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  deckTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  deckMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 1, marginBottom: 7 },
  masteryTrack: { height: 6, borderRadius: 4, backgroundColor: colors.bgAlt, overflow: 'hidden' },
  masteryFill: { height: 6, borderRadius: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  pickLabel: { fontSize: font.small, fontWeight: '700', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  emojiPick: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  colorPick: { width: 36, height: 36, borderRadius: radius.pill },
  colorPickActive: { borderWidth: 3, borderColor: colors.text },
  filterRow: { gap: 8, paddingVertical: 6, paddingHorizontal: 2, marginBottom: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: font.small },
  chipTextActive: { color: '#fff' },
});
