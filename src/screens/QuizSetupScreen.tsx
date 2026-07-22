import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { Button, Card, ScreenScroll, StackHeader, SectionHeader, EmptyState } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { extractTextFromImage, AIError, resolveKey, AI_CAPS } from '../ai/client';
import { pickImageDataUrl } from '../ai/ocr';
import { useT } from '../i18n';

type Source = { kind: 'text'; text: string } | { kind: 'note'; noteId: string } | { kind: 'deck'; deckId: string };

export function QuizSetupScreen() {
  const { state } = useApp();
  const nav = useNav();
  const { t: tr } = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok' | 'info'; text: string } | null>(null);

  const flash = (kind: 'err' | 'ok' | 'info', t: string) => {
    setMsg({ kind, text: t });
    setTimeout(() => setMsg((m) => (m && m.text === t ? null : m)), 4500);
  };

  const runText = () => {
    const t = text.trim();
    if (t.length < 20) { flash('info', tr('quizSetup.needMoreText')); return; }
    if (!resolveKey(state.settings.apiKey)) { flash('err', tr('ai.needKey')); return; }
    nav.push('Quiz', { source: t, title: tr('quizSetup.fromTextTitle') });
  };

  const runNote = (noteId: string) => {
    const note = state.notes.find((n) => n.id === noteId);
    if (!note || note.body.trim().length < 20) { flash('info', tr('quizSetup.noteTooShort')); return; }
    if (!resolveKey(state.settings.apiKey)) { flash('err', tr('ai.needKey')); return; }
    nav.push('Quiz', { source: note.body, title: note.title ? tr('quizSetup.namedTitle', { name: note.title }) : tr('quizSetup.fromNoteTitle') });
  };

  const runDeck = (deckId: string) => {
    const cards = state.cards.filter((c) => c.deckId === deckId);
    if (cards.length < 4) { flash('info', tr('quizSetup.needFourCards')); return; }
    const deck = state.decks.find((d) => d.id === deckId);
    nav.push('Quiz', { deckId, title: deck?.title || tr('quizSetup.fromDeckTitle') });
  };

  const runPhoto = async (useCamera: boolean) => {
    setPhotoOpen(false);
    if (!resolveKey(state.settings.apiKey)) { flash('err', tr('ai.needKey')); return; }
    setBusy(true);
    try {
      const url = await pickImageDataUrl(useCamera);
      if (!url) { setBusy(false); return; }
      setPreviewUri(url);
      const out = await extractTextFromImage(url, state.settings.apiKey);
      const clean = (out || '').trim();
      if (!clean) { flash('err', tr('photo.noText')); return; }
      setText((prev) => (prev.trim() ? prev + '\n' + clean : clean));
      flash('ok', tr('quizSetup.photoTextAdded'));
    } catch (e: any) {
      flash('err', e instanceof AIError ? e.message : tr('photo.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={tr('quizSetup.title')} onBack={nav.pop} />
      <ScreenScroll>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="help-circle" size={26} color={colors.primary} /></View>
          <Text style={styles.heroTitle}>{tr('quizSetup.heroTitle')}</Text>
          <Text style={styles.heroSub}>{tr('quizSetup.heroSub')}</Text>
        </View>

        {AI_CAPS.quiz && (<>
        <SectionHeader title={tr('quizSetup.ownTextOrPhoto')} />
        <Card>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={tr('quizSetup.textPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            textAlignVertical="top"
          />
          {previewUri && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
              <Pressable onPress={() => setPreviewUri(null)} style={styles.previewRemove}><Ionicons name="close" size={16} color="#fff" /></Pressable>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.sm }}>
            {AI_CAPS.vision && <Button title={tr('quizSetup.photoOrGallery')} icon="camera" variant="secondary" small loading={busy} onPress={() => setPhotoOpen(true)} style={{ flex: 1 }} />}
            <Button title={tr('quizSetup.create')} icon="sparkles" small onPress={runText} disabled={text.trim().length < 20} style={{ flex: 1.2 }} />
          </View>
        </Card>
        </>)}

        {AI_CAPS.quiz && state.notes.length > 0 && (
          <>
            <SectionHeader title={tr('quizSetup.fromNotes')} />
            {state.notes.slice(0, 8).map((n) => (
              <Card key={n.id} style={{ marginBottom: 8 }} onPress={() => runNote(n.id)}>
                <View style={styles.row}>
                  <View style={styles.noteIcon}><Ionicons name="document-text-outline" size={18} color={colors.accent} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{n.title || tr('note.untitled')}</Text>
                    <Text style={styles.rowSub}>{tr('quizSetup.words', { n: Math.max(1, n.body.split(/\s+/).length) })}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </View>
              </Card>
            ))}
          </>
        )}

        {state.decks.length > 0 && (
          <>
            <SectionHeader title={tr('quizSetup.fromDeck')} />
            {state.decks.map((d) => {
              const count = state.cards.filter((c) => c.deckId === d.id).length;
              return (
                <Card key={d.id} style={{ marginBottom: 8 }} onPress={() => runDeck(d.id)}>
                  <View style={styles.row}>
                    <View style={[styles.deckIcon, { backgroundColor: d.color + '22' }]}><Text style={{ fontSize: 18 }}>{d.emoji}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{d.title}</Text>
                      <Text style={styles.rowSub}>{tr(count === 1 ? 'quizSetup.cards.one' : count < 5 ? 'quizSetup.cards.few' : 'quizSetup.cards.many', { n: count })}{d.subject ? ` · ${d.subject}` : ''}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {state.notes.length === 0 && state.decks.length === 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState icon="albums-outline" title={tr('quizSetup.empty')} subtitle={tr('quizSetup.emptySub')} />
          </View>
        )}

        {msg && (
          <View style={[styles.banner, msg.kind === 'err' ? styles.bErr : msg.kind === 'ok' ? styles.bOk : styles.bInfo]}>
            <Text style={styles.bannerText}>{msg.text}</Text>
          </View>
        )}
      </ScreenScroll>

      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPhotoOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{tr('quizSetup.scanTitle')} 📷</Text>
            <Text style={styles.sheetSub}>{tr('photo.whereFrom')}</Text>
            <Button title={tr('photo.take')} icon="camera" onPress={() => runPhoto(true)} />
            <View style={{ height: 8 }} />
            <Button title={tr('photo.gallery')} icon="images" variant="secondary" onPress={() => runPhoto(false)} />
            <View style={{ height: 8 }} />
            <Button title={tr('common.cancel')} variant="ghost" onPress={() => setPhotoOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.busyText}>{tr('photo.reading')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.md, gap: 6, marginBottom: spacing.md },
  heroIcon: { width: 56, height: 56, borderRadius: 9999, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { fontSize: font.h2, fontWeight: '800', color: colors.text, lineHeight: font.h2 + 8 },
  heroSub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: font.small + 6 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, minHeight: 120, fontSize: font.body, color: colors.text, lineHeight: font.body + 6 },
  previewWrap: { marginTop: spacing.sm, borderRadius: radius.md, overflow: 'hidden' },
  preview: { width: '100%', height: 180 },
  previewRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  deckIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: font.body, fontWeight: '700', color: colors.text, lineHeight: font.body + 6 },
  rowSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, lineHeight: font.tiny + 5 },
  banner: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  bInfo: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  bErr: { backgroundColor: '#3a1212', borderColor: colors.danger },
  bOk: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  bannerText: { color: colors.text, fontSize: font.small, fontWeight: '600', lineHeight: font.small + 6 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.xl, padding: spacing.lg },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, lineHeight: font.h3 + 8 },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.md, lineHeight: font.small + 6 },
  busyOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  busyText: { color: '#fff', fontWeight: '700', fontSize: font.body },
});
