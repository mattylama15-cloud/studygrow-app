import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { Button, Card, Field, ScreenScroll, StackHeader, Pill, EmptyState } from '../components/ui';
import { gradients } from '../theme';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { deckMastery, isDue } from '../srs';
import { generateFlashcards, AIError, extractTextFromImage, AI_CAPS } from '../ai/client';
import { pickImageDataUrl } from '../ai/ocr';
import { Flashcard, DeckSource } from '../types';
import { useT } from '../i18n';

export function DeckDetailScreen({ params }: { params?: Record<string, any> }) {
  const deckId = params?.deckId as string;
  const { state, addCards, deleteCard, deleteDeck, addDeckSource, deleteDeckSource } = useApp();
  const nav = useNav();
  const { t } = useT();
  const [showAdd, setShowAdd] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const deck = state.decks.find((d) => d.id === deckId);
  const cards = useMemo(() => state.cards.filter((c) => c.deckId === deckId), [state.cards, deckId]);
  const sources = deck?.sources ?? [];
  if (!deck) {
    return <View style={{ flex: 1 }}><StackHeader title={t('deck.title')} onBack={nav.pop} /><EmptyState icon="alert-circle" title={t('deck.notFound')} /></View>;
  }

  const due = cards.filter((c) => isDue(c)).length;
  const mastery = Math.round(deckMastery(cards) * 100);

  const confirmDelete = () => setConfirmOpen(true);
  const showWarn = (msg: string) => { setWarning(msg); setTimeout(() => setWarning((w) => (w === msg ? null : w)), 4500); };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={deck.title} onBack={nav.pop} right={
        <Pressable onPress={confirmDelete} hitSlop={8}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
      } />
      <ScreenScroll contentStyle={{ paddingTop: 4 }}>
        {/* hero */}
        <Card style={{ alignItems: 'center', gap: 4, marginBottom: spacing.md }}>
          <View style={[styles.bigEmoji, { backgroundColor: deck.color + '22' }]}><Text style={{ fontSize: 34 }}>{deck.emoji}</Text></View>
          <Text style={styles.title}>{deck.title}</Text>
          {deck.subject ? <Pill label={deck.subject} color={deck.color} /> : null}
          <View style={styles.statsRow}>
            <Stat value={`${cards.length}`} label={t('deck.stat.cards')} />
            <Stat value={`${due}`} label={t('deck.stat.due')} />
            <Stat value={`${mastery}%`} label={t('deck.stat.mastery')} color={deck.color} />
          </View>
        </Card>

        {/* Nahrané materiály — z nich AI tvoří kartičky. Hromadí se. */}
        {sources.length > 0 && sources.map((s) => (
          <Card key={s.id} style={styles.sourceItem}>
            <View style={styles.sourceIcon}><Ionicons name="document-text-outline" size={18} color={colors.textMuted} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sourceName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.sourceMeta}>{t('deck.sourceChars', { n: s.text.length })}</Text>
            </View>
            <Pressable onPress={() => deleteDeckSource(deckId, s.id)} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textFaint} />
            </Pressable>
          </Card>
        ))}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={t('deck.addManual')} icon="add" variant="secondary" onPress={() => setShowAdd(true)} small style={{ flex: 1 }} />
          <Button title={t('deck.fromPhoto')} icon="camera" variant="secondary" onPress={() => setShowPhoto(true)} small style={{ flex: 1 }} />
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Button title={due > 0 ? `${t('deck.study')} (${due})` : t('deck.practice')} icon="flash" onPress={() => nav.push('Study', { deckId })}
            gradient={['#22C55E', '#15803D']} small style={{ flex: 1 }} />
          {AI_CAPS.flashcards && (
            <Button title={t('deck.aiCards')} icon="sparkles" disabled={sources.length === 0}
              onPress={() => setShowAI(true)} gradient={gradients.ai as [string, string]} small style={{ flex: 1 }} />
          )}
        </View>
        {/* Kontrola kartiček je součástí generování — AI si výsledek prověří sama. */}

        <Text style={styles.listHeader}>{t('deck.cardsCount', { n: cards.length })}</Text>
        {cards.length === 0 ? (
          <EmptyState icon="albums-outline" title={t('deck.empty')} subtitle={t('deck.emptySub')} />
        ) : (
          cards.map((c) => (
            <Card key={c.id} style={styles.cardItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardFront}>{c.front}</Text>
                <Text style={styles.cardBack}>{c.back}</Text>
              </View>
              <Pressable onPress={() => deleteCard(c.id)} hitSlop={8}><Ionicons name="close" size={18} color={colors.textFaint} /></Pressable>
            </Card>
          ))
        )}
      </ScreenScroll>

      <AddCardModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={(front, back) => { addCards(deckId, [{ front, back }]); }} />
      <AIGenerateModal visible={showAI} sources={sources} onClose={() => setShowAI(false)}
        onGenerate={(cardsGen) => { addCards(deckId, cardsGen); setShowAI(false); }} />
      <PhotoSourceModal visible={showPhoto} onClose={() => setShowPhoto(false)}
        onAdd={(name, text) => { addDeckSource(deckId, name, text); setShowPhoto(false); }} />

      {warning && (
        <View style={pickerStyles.warnWrap}><View style={pickerStyles.warn}><Text style={pickerStyles.warnText}>{warning}</Text></View></View>
      )}

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
        <Pressable style={pickerStyles.bg} onPress={() => setConfirmOpen(false)}>
          <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={pickerStyles.title}>{t('deck.deleteTitle')}</Text>
            <Text style={pickerStyles.sub}>{t('deck.deleteSub', { title: deck.title, n: cards.length })}</Text>
            <Button title={t('common.delete')} icon="trash" variant="danger" onPress={() => { setConfirmOpen(false); deleteDeck(deck.id); nav.pop(); }} />
            <View style={{ height: 8 }} />
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setConfirmOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Stat({ value, label, color = colors.text }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ✅ AI kontrola: nejčastější slabina AI-kartiček jsou nepřesné odpovědi.
// AI projede balíček, vypíše jen problematické karty a nabídne opravu jedním tapem.
function AddCardModal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (f: string, b: string) => void }) {
  const { t } = useT();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const save = () => { if (!front.trim() || !back.trim()) return; onAdd(front.trim(), back.trim()); setFront(''); setBack(''); onClose(); };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('deck.newCard')}</Text>
          <Field value={front} onChangeText={setFront} placeholder={t('deck.front')} autoFocus />
          <View style={{ height: 10 }} />
          <Field value={back} onChangeText={setBack} placeholder={t('deck.back')} multiline />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('common.add')} icon="checkmark" onPress={save} disabled={!front.trim() || !back.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Vyfotí (nebo vybere) stránku poznámek, přepíše ji na text a uloží jako materiál. */
function PhotoSourceModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void; onAdd: (name: string, text: string) => void;
}) {
  const { state } = useApp();
  const { t } = useT();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => { if (visible) setError(null); }, [visible]);

  const runScan = async (useCamera: boolean) => {
    const key = state.settings.apiKey;
    if (!key) { setError(t('deck.needKey')); return; }
    setScanning(true); setError(null);
    try {
      const url = await pickImageDataUrl(useCamera);
      if (!url) { setScanning(false); return; }
      const text = await extractTextFromImage(url, key);
      if (text && text.trim()) {
        onAdd(useCamera ? t('deck.sourcePhoto') : t('deck.sourceGallery'), text.trim());
      } else {
        setError(t('deck.ocrNoText'));
      }
    } catch (e: any) {
      setError(e instanceof AIError ? e.message : t('deck.ocrFailed'));
    } finally {
      setScanning(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={pickerStyles.bg} onPress={onClose}>
        <Pressable style={pickerStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={pickerStyles.title}>{t('deck.scanTitle')}</Text>
          <Text style={pickerStyles.sub}>{t('deck.scanSub')}</Text>
          <Button title={t('deck.takePhoto')} icon="camera" loading={scanning} onPress={() => runScan(true)} />
          <View style={{ height: 8 }} />
          <Button title={t('deck.fromGallery')} icon="images" variant="secondary" loading={scanning} onPress={() => runScan(false)} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ height: 8 }} />
          <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AIGenerateModal({ visible, onClose, onGenerate, sources }: {
  visible: boolean; onClose: () => void; onGenerate: (cards: { front: string; back: string }[]) => void;
  sources: DeckSource[];
}) {
  const { state } = useApp();
  const { t } = useT();
  const [focus, setFocus] = useState('');
  const [count, setCount] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => { if (visible) { setFocus(''); setError(null); } }, [visible]);

  // AI tvoří ze VŠECH nahraných materiálů dohromady.
  const material = sources.map((s) => s.text).join('\n\n');

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const cards = await generateFlashcards(material, count, state.settings.apiKey, state.settings.model, focus);
      if (cards.length === 0) throw new AIError(t('deck.aiNoCards'));
      onGenerate(cards);
    } catch (e: any) {
      setError(e instanceof AIError ? e.message : t('deck.aiFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('deck.aiTitle')}</Text>

          {/* Materiál se nevybírá — je to ten, co uživatel nahrál fotkou. */}
          <Text style={styles.fieldLabel}>{t('deck.fromMaterial')}</Text>
          {sources.map((s) => (
            <View key={s.id} style={styles.sourceInSheet}>
              <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
              <Text style={styles.sourceInSheetName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.sourceInSheetMeta}>{t('deck.sourceChars', { n: s.text.length })}</Text>
            </View>
          ))}

          <Text style={styles.fieldLabel}>{t('deck.focusLabel')}</Text>
          <Field value={focus} onChangeText={setFocus} placeholder={t('deck.focusPlaceholder')} multiline autoFocus />
          <Text style={styles.sheetSub}>{t('deck.focusHint')}</Text>

          <Text style={styles.pickLabel}>{t('deck.cardCountLabel', { n: count })}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[5, 8, 12, 15].map((n) => (
              <Pressable key={n} onPress={() => setCount(n)} style={[styles.countPick, count === n && styles.countPickActive]}>
                <Text style={[styles.countText, count === n && { color: '#fff' }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('deck.generate')} icon="sparkles" onPress={run} loading={loading} disabled={!material.trim()}
              gradient={gradients.ai as [string, string]} style={{ flex: 1.4 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bigEmoji: { width: 68, height: 68, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: font.h2, fontWeight: '800', color: colors.text, textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginTop: spacing.md, width: '100%' },
  statValue: { fontSize: font.h3, fontWeight: '800' },
  statLabel: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  listHeader: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },

  // nahraný materiál (fotka poznámek)
  sourceItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sourceIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  sourceName: { fontSize: font.small, fontWeight: '600', color: colors.text },
  sourceMeta: { fontSize: font.tiny, color: colors.textFaint, marginTop: 1 },
  fieldLabel: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, marginTop: spacing.md, marginBottom: 6 },
  sourceInSheet: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 10, marginBottom: 6 },
  sourceInSheetName: { fontSize: font.small, color: colors.text, flex: 1 },
  sourceInSheetMeta: { fontSize: font.tiny, color: colors.textFaint },
  cardItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardFront: { fontSize: font.body, fontWeight: '700', color: colors.text },
  cardBack: { fontSize: font.small, color: colors.textMuted, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.md },
  pickLabel: { fontSize: font.small, fontWeight: '700', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  countPick: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  countPickActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  countText: { fontWeight: '700', color: colors.textMuted },
  error: { color: colors.danger, fontSize: font.small, marginTop: spacing.md, fontWeight: '600' },
  issueProblem: { color: colors.amber, fontSize: font.small, fontWeight: '700', marginTop: 6, lineHeight: 19 },
  issueFix: { color: colors.text, fontSize: font.small, marginTop: 4, lineHeight: 19 },
});

const pickerStyles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.xl, padding: spacing.lg },
  title: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  warnWrap: { position: 'absolute', left: 0, right: 0, top: 60, alignItems: 'center', paddingHorizontal: spacing.lg },
  warn: { backgroundColor: colors.amberSoft, borderColor: colors.amber, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, maxWidth: 420 },
  warnText: { color: colors.text, fontSize: font.small, fontWeight: '600', lineHeight: 19 },
});
