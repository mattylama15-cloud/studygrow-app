import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing, deckColors } from '../theme';
import { StackHeader, EmptyState, Button } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { generateFlashcards, summarizeToNotes, AIError, resolveKey, extractTextFromImage, AI_CAPS } from '../ai/client';
import { pickImageDataUrl } from '../ai/ocr';
import { Markdown } from '../components/Markdown';
import { useT } from '../i18n';

export function NoteEditorScreen({ params }: { params?: Record<string, any> }) {
  const { state, updateNote, deleteNote, addDeck, addCards } = useApp();
  const nav = useNav();
  const { t: tr } = useT();

  // The note is always created by the caller and passed by id.
  const id = params?.noteId as string;
  const note = state.notes.find((n) => n.id === id);

  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [busy, setBusy] = useState<null | 'cards' | 'summary' | 'photo'>(null);
  // Auto-preview: if the note already has Markdown (#, **, ---) it opens in pretty view by default.
  const looksLikeMarkdown = /(^|\n)(#{1,6}\s|---|\*\*[^\n]+\*\*|^\s*[-*]\s)/m.test(note?.body || '');
  const [mode, setMode] = useState<'read' | 'edit'>(looksLikeMarkdown ? 'read' : 'edit');
  const [msg, setMsg] = useState<{ kind: 'info' | 'err' | 'ok'; text: string } | null>(null);
  const [photoChooserOpen, setPhotoChooserOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [doneDeck, setDoneDeck] = useState<{ id: string; count: number } | null>(null);

  const flash = (kind: 'info' | 'err' | 'ok', text: string) => {
    setMsg({ kind, text });
    setTimeout(() => setMsg((m) => (m && m.text === text ? null : m)), 4500);
  };

  if (!note) {
    return (
      <View style={{ flex: 1 }}>
        <StackHeader title={tr('note.title')} onBack={nav.pop} />
        <EmptyState icon="document-text-outline" title={tr('note.notFound')} />
      </View>
    );
  }

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const persist = (patch: { title?: string; body?: string }) => {
    updateNote(id, patch);
    setSavedAt(Date.now());
  };

  const onTitle = (t: string) => { setTitle(t); persist({ title: t }); };
  const onBody = (t: string) => { setBody(t); persist({ body: t }); };

  const runPhoto = async (useCamera: boolean) => {
    setPhotoChooserOpen(false);
    if (!resolveKey(state.settings.apiKey)) {
      flash('err', tr('note.needKeyPhoto'));
      return;
    }
    setBusy('photo');
    try {
      const url = await pickImageDataUrl(useCamera);
      if (!url) { setBusy(null); return; }
      const text = await extractTextFromImage(url, state.settings.apiKey);
      if (text && text.trim()) {
        const next = body.trim() ? `${body}\n${text.trim()}` : text.trim();
        setBody(next); persist({ body: next });
        flash('ok', tr('note.photoAdded'));
      } else flash('err', tr('photo.noText'));
    } catch (e: any) {
      flash('err', e instanceof AIError ? e.message : tr('photo.failed'));
    } finally {
      setBusy(null);
    }
  };

  const makeCards = async () => {
    if (body.trim().length < 20) { flash('info', tr('note.needMoreTextCards')); return; }
    if (!resolveKey(state.settings.apiKey)) { flash('err', tr('ai.needKey')); return; }
    setBusy('cards');
    try {
      const cards = await generateFlashcards(body, 10, state.settings.apiKey, state.settings.model);
      if (cards.length === 0) throw new AIError(tr('note.err.cards'));
      const color = deckColors[Math.floor(Math.random() * deckColors.length)];
      const deck = addDeck({ title: title.trim() || tr('note.deckFromNote'), subject: tr('notes.title'), emoji: '📝', color });
      addCards(deck.id, cards);
      setDoneDeck({ id: deck.id, count: cards.length });
    } catch (e: any) {
      flash('err', e instanceof AIError ? e.message : tr('note.err.generic'));
    } finally {
      setBusy(null);
    }
  };

  const makeSummary = async () => {
    if (body.trim().length < 20) { flash('info', tr('note.needMoreTextSummary')); return; }
    if (!resolveKey(state.settings.apiKey)) { flash('err', tr('ai.needKey')); return; }
    setBusy('summary');
    try {
      const summary = await summarizeToNotes(body, state.settings.apiKey, state.settings.model);
      const next = `${body}\n\n──────────\n\n✨ ${tr('note.summaryHeading')}\n\n${summary.trim()}`;
      setBody(next); persist({ body: next });
      setMode('read'); // switch to pretty view so the new summary renders nicely
      flash('ok', tr('note.summaryAdded'));
    } catch (e: any) {
      flash('err', e instanceof AIError ? e.message : tr('note.err.generic'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader title={tr('note.title')} onBack={nav.pop} right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => setMode((m) => (m === 'read' ? 'edit' : 'read'))} hitSlop={8} style={styles.modeBtn}>
            <Ionicons name={mode === 'read' ? 'create-outline' : 'eye-outline'} size={16} color={colors.primary} />
            <Text style={styles.modeBtnText}>{tr(mode === 'read' ? 'note.edit' : 'note.preview')}</Text>
          </Pressable>
          <Pressable onPress={() => setConfirmDeleteOpen(true)} hitSlop={8}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
        </View>
      } />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        {mode === 'edit' ? (
          <>
            <View style={styles.savedRow}>
              <Ionicons name="cloud-done-outline" size={14} color={colors.textFaint} />
              <Text style={styles.savedText}>{tr(savedAt ? 'note.saved' : 'note.autosave')}</Text>
            </View>
            <TextInput value={title} onChangeText={onTitle} placeholder={tr('note.namePlaceholder')} placeholderTextColor={colors.textFaint} style={styles.title} />
            <TextInput value={body} onChangeText={onBody} placeholder={tr('note.bodyPlaceholder')} placeholderTextColor={colors.textFaint}
              style={styles.body} multiline textAlignVertical="top" />
          </>
        ) : (
          <View>
            <Text style={styles.title}>{title || tr('note.untitled')}</Text>
            {body.trim() ? (
              <View style={{ marginTop: spacing.sm }}><Markdown text={body} /></View>
            ) : (
              <Pressable onPress={() => setMode('edit')}>
                <Text style={[styles.body, { color: colors.textFaint, marginTop: spacing.sm }]}>{tr('note.tapEdit')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {msg && (
          <View style={[styles.banner, msg.kind === 'err' ? styles.bErr : msg.kind === 'ok' ? styles.bOk : styles.bInfo]}>
            <Text style={styles.bannerText}>{msg.text}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.toolbar}>
        {AI_CAPS.vision && <ToolButton icon="camera" label={tr('note.tool.photo')} active={busy === 'photo'} loading={busy === 'photo'} onPress={() => setPhotoChooserOpen(true)} />}
        {AI_CAPS.flashcards && <ToolButton icon="sparkles" label={tr('note.tool.cards')} active={busy === 'cards'} loading={busy === 'cards'} onPress={makeCards} />}
        {AI_CAPS.quiz && <ToolButton icon="help-circle" label={tr('note.tool.quiz')} onPress={() => {
          if (body.trim().length < 20) { flash('info', tr('note.needMoreTextQuiz')); return; }
          if (!resolveKey(state.settings.apiKey)) { flash('err', tr('ai.needKey')); return; }
          nav.push('Quiz', { source: body, title: title.trim() || tr('quizSetup.fromNoteTitle') });
        }} />}
        {AI_CAPS.summarize && <ToolButton icon="document-text" label={tr('note.tool.summarize')} active={busy === 'summary'} loading={busy === 'summary'} onPress={makeSummary} />}
      </View>

      {/* Foto chooser — Alert.alert nefunguje na webu */}
      <Modal visible={photoChooserOpen} transparent animationType="fade" onRequestClose={() => setPhotoChooserOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setPhotoChooserOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{tr('note.scanTitle')} 📷</Text>
            <Text style={styles.sheetSub}>{tr('photo.whereFrom')}</Text>
            <Button title={tr('photo.take')} icon="camera" onPress={() => runPhoto(true)} />
            <View style={{ height: 8 }} />
            <Button title={tr('photo.gallery')} icon="images" variant="secondary" onPress={() => runPhoto(false)} />
            <View style={{ height: 8 }} />
            <Button title={tr('common.cancel')} variant="ghost" onPress={() => setPhotoChooserOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Smazání — vlastní modal místo Alert.alert */}
      <Modal visible={confirmDeleteOpen} transparent animationType="fade" onRequestClose={() => setConfirmDeleteOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setConfirmDeleteOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{tr('note.deleteTitle')}</Text>
            <Text style={styles.sheetSub}>{tr('note.deleteSub')}</Text>
            <Button title={tr('common.delete')} icon="trash" variant="danger" onPress={() => { setConfirmDeleteOpen(false); deleteNote(id); nav.pop(); }} />
            <View style={{ height: 8 }} />
            <Button title={tr('common.cancel')} variant="ghost" onPress={() => setConfirmDeleteOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Hotovo – kartičky */}
      <Modal visible={!!doneDeck} transparent animationType="fade" onRequestClose={() => setDoneDeck(null)}>
        <Pressable style={styles.modalBg} onPress={() => setDoneDeck(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{tr('note.doneTitle')}</Text>
            <Text style={styles.sheetSub}>{tr('note.doneSub', { n: doneDeck?.count ?? 0 })}</Text>
            <Button title={tr('note.openDeck')} icon="albums" onPress={() => { const d = doneDeck; setDoneDeck(null); if (d) { nav.pop(); nav.push('DeckDetail', { deckId: d.id }); } }} />
            <View style={{ height: 8 }} />
            <Button title={tr('common.stay')} variant="ghost" onPress={() => setDoneDeck(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function ToolButton({ icon, label, onPress, loading, active }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; loading?: boolean; active?: boolean;
}) {
  // Defaults to muted gray; turns green (colors.primary) only while busy/active.
  const tint = active || loading ? colors.primary : colors.textMuted;
  return (
    <Pressable onPress={onPress} disabled={loading} style={[styles.toolBtn, { opacity: loading ? 0.6 : 1 }]}>
      {loading ? <ActivityIndicator color={tint} size="small" /> : <Ionicons name={icon} size={20} color={tint} />}
      <Text style={[styles.toolLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h2, fontWeight: '800', color: colors.text, paddingVertical: 8 },
  body: { fontSize: font.body, color: colors.text, lineHeight: 24, minHeight: 300, paddingTop: 8 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  modeBtnText: { color: colors.primary, fontSize: font.small, fontWeight: '800' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, opacity: 0.7 },
  savedText: { color: colors.textFaint, fontSize: font.tiny, fontWeight: '600' },
  toolbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingVertical: spacing.sm },
  toolBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 8 },
  toolLabel: { fontSize: font.tiny, fontWeight: '700' },
  banner: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  bInfo: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  bErr: { backgroundColor: '#3a1212', borderColor: colors.danger },
  bOk: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  bannerText: { color: colors.text, fontSize: font.small, fontWeight: '600', lineHeight: 19 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.xl, padding: spacing.lg, gap: 6 },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.md },
});
