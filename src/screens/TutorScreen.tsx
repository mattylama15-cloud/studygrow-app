import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, radius, spacing, shadow, gradients } from '../theme';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { tutorReply, AIError, resolveKey, AI_CAPS } from '../ai/client';
import { pickImages } from '../ai/ocr';
import { Markdown } from '../components/Markdown';
import { uid } from '../utils';
import { ChatMessage } from '../types';
import { findContext, buildContextBlock, buildFullContext } from '../rag';
import { useT } from '../i18n';
import { speak } from '../speech';

const SUGGESTIONS = [
  { emoji: '🧪', key: 'tutor.suggest.photosynthesis' },
  { emoji: '➗', key: 'tutor.suggest.quadratic' },
  { emoji: '📜', key: 'tutor.suggest.ww1' },
  { emoji: '🇬🇧', key: 'tutor.suggest.prepositions' },
];

export function TutorScreen() {
  const { state, addChat, updateChat, newChatThread, switchChatThread, deleteChatThread, renameChatThread } = useApp();
  const nav = useNav();
  const { t: tr } = useT();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attached, setAttached] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const activeThread = state.chatThreads.find((t) => t.id === state.activeChatId);
  const messages = activeThread?.messages ?? [];

  const pick = async (useCamera: boolean) => {
    setAttaching(true);
    setPickError(null);
    try {
      const urls = await pickImages(useCamera);
      if (urls.length) setAttached((prev) => [...prev, ...urls].slice(0, 10));
    } catch (e: any) {
      const msg = e instanceof AIError ? e.message : tr('tutor.err.attach');
      setPickError(msg);
      setTimeout(() => setPickError(null), 4500);
    } finally {
      setAttaching(false);
    }
  };

  const attach = () => setChooserOpen(true);
  const chooseSource = (useCamera: boolean) => { setChooserOpen(false); pick(useCamera); };

  const send = async (text: string) => {
    const content = text.trim();
    const imgs = attached;
    if ((!content && imgs.length === 0) || sending) return;
    setInput('');
    setAttached([]);
    const userMsg: ChatMessage = { id: uid('m'), role: 'user', text: content || tr('tutor.helpWithAttachments'), ts: Date.now(), images: imgs.length ? imgs : undefined };
    const pendingId = uid('m');
    addChat(userMsg);
    addChat({ id: pendingId, role: 'assistant', text: '', ts: Date.now(), pending: true });
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const history = [...messages, userMsg];
      // RAG: look at the latest user text and any short context from previous user turns.
      const ragQuery = content || (history.filter((m) => m.role === 'user').slice(-2).map((m) => m.text).join(' '));
      const hits = ragQuery ? findContext(state, ragQuery, 4) : [];
      // AI vidí ÚPLNĚ VŠECHNO: celkový přehled aplikace (balíčky, zkoušky, úkoly,
      // chyby, streak…) + relevantní úryvky z poznámek/kartiček k dané otázce.
      // Instrukci o jazyce přidává už samotný AI klient (viz ai/provider.ts).
      const ctx = buildFullContext(state) + buildContextBlock(hits);
      const reply = await tutorReply(history, state.settings.apiKey, state.settings.model, imgs, ctx);
      updateChat(pendingId, { text: reply, pending: false });
    } catch (e: any) {
      const msg = e instanceof AIError ? e.message : tr('tutor.err.generic');
      updateChat(pendingId, { text: `⚠️ ${msg}`, pending: false });
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  const hasKey = !!resolveKey(state.settings.apiKey);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* header */}
      <View style={styles.header}>
        <Pressable onPress={() => setHistoryOpen(true)} hitSlop={10} style={styles.menuBtn}>
          <Ionicons name="menu" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{activeThread?.title || tr('tutor.title')}</Text>
      </View>

      {!hasKey && (
        <Pressable onPress={() => nav.push('AiKey')} style={styles.keyBanner}>
          <Ionicons name="key-outline" size={16} color={colors.amber} />
          <Text style={styles.keyBannerText}>{tr('tutor.keyBanner')}</Text>
        </Pressable>
      )}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <LinearGradient colors={gradients.ai as [string, string]} style={styles.welcomeAvatar}><Ionicons name="sparkles" size={28} color="#fff" /></LinearGradient>
            <Text style={styles.welcomeTitle}>{tr('tutor.welcomeTitle')}</Text>
            <Text style={styles.welcomeSub}>{tr('tutor.welcomeSub')}</Text>
            <View style={{ gap: 8, marginTop: spacing.lg, alignSelf: 'stretch' }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s.key} onPress={() => send(tr(s.key))} style={styles.suggestion}>
                  <Text style={styles.suggestionText}>{s.emoji} {tr(s.key)}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </ScrollView>

      {/* attachment preview (up to 10) */}
      {attached.length > 0 && (
        <View style={styles.attachWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
            {attached.map((url, i) => (
              <View key={i} style={styles.attachItem}>
                <Image source={{ uri: url }} style={styles.attachThumb} resizeMode="cover" />
                <Pressable onPress={() => setAttached((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={6} style={styles.attachRemove}>
                  <Ionicons name="close-circle" size={20} color={colors.text} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Text style={styles.attachHint}>{tr(attached.length > 1 ? 'tutor.attachHint.many' : 'tutor.attachHint.one', { n: attached.length })}</Text>
        </View>
      )}

      {pickError && (
        <View style={styles.pickErrBox}><Text style={styles.pickErrText}>⚠️ {pickError}</Text></View>
      )}

      {/* input */}
      <View style={styles.inputBar}>
        {AI_CAPS.vision && (
          <Pressable onPress={attach} disabled={attaching || attached.length >= 10}
            style={[styles.plusBtn, (attaching || attached.length >= 10) && { opacity: 0.5 }]}>
            {attaching ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons name="add" size={24} color={colors.accent} />}
          </Pressable>
        )}
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={tr('tutor.placeholder')}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <Pressable onPress={() => send(input)} disabled={(!input.trim() && attached.length === 0) || sending}
          style={[styles.sendBtn, { opacity: (!input.trim() && attached.length === 0) || sending ? 0.5 : 1 }]}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
        </Pressable>
      </View>

      {/* attachment source chooser — custom sheet (Alert doesn't work on web) */}
      <Modal visible={chooserOpen} transparent animationType="fade" onRequestClose={() => setChooserOpen(false)}>
        <View style={styles.chooserBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChooserOpen(false)} />
          <View style={styles.chooserSheet}>
            <View style={styles.chooserHandle} />
            <Text style={styles.chooserTitle}>{tr('tutor.attachTitle')} 📎</Text>
            <Pressable style={styles.chooserItem} onPress={() => chooseSource(true)}>
              <Ionicons name="camera-outline" size={22} color={colors.accent} />
              <Text style={styles.chooserItemText}>{tr('tutor.takePhoto')}</Text>
            </Pressable>
            <Pressable style={styles.chooserItem} onPress={() => chooseSource(false)}>
              <Ionicons name="image-outline" size={22} color={colors.accent} />
              <Text style={styles.chooserItemText}>{tr('tutor.fromGallery')}</Text>
            </Pressable>
            <Pressable style={styles.chooserCancel} onPress={() => setChooserOpen(false)}>
              <Text style={styles.chooserCancelText}>{tr('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* History drawer — list of past conversations */}
      <Modal visible={historyOpen} transparent animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.histBg}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHistoryOpen(false)} />
          <View style={styles.histPanel}>
            <View style={styles.histHeader}>
              <Text style={styles.histTitle}>{tr('tutor.history')}</Text>
              <Pressable hitSlop={8} onPress={() => setHistoryOpen(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Pressable style={styles.newChatBtn} onPress={() => { newChatThread(); setHistoryOpen(false); setInput(''); setAttached([]); }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.newChatText}>{tr('tutor.newChat')}</Text>
            </Pressable>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }}>
              {state.chatThreads.length === 0 ? (
                <Text style={styles.histEmpty}>{tr('tutor.noChats')}</Text>
              ) : (
                [...state.chatThreads].sort((a, b) => b.updatedAt - a.updatedAt).map((t) => {
                  const isActive = t.id === state.activeChatId;
                  const preview = t.messages.length === 0
                    ? tr('tutor.emptyChat')
                    : stripMarkdown(t.messages[t.messages.length - 1].text || '').slice(0, 70);
                  return (
                    <View key={t.id} style={[styles.threadRow, isActive && styles.threadRowActive]}>
                      <Pressable style={{ flex: 1 }} onPress={() => { switchChatThread(t.id); setHistoryOpen(false); }}>
                        <Text style={styles.threadTitle} numberOfLines={1}>{t.title}</Text>
                        <Text style={styles.threadPreview} numberOfLines={1}>{preview}</Text>
                      </Pressable>
                      <Pressable hitSlop={6} onPress={() => deleteChatThread(t.id)}>
                        <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const { t: tr, lang } = useT();
  const isUser = m.role === 'user';
  if (m.pending) {
    return (
      <View style={[styles.bubble, styles.assistant]}>
        <Text style={styles.typing}>{tr('tutor.typing')}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
      {m.images && m.images.length ? (
        <View style={styles.bubbleImages}>
          {m.images.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={styles.bubbleImage} resizeMode="cover" />
          ))}
        </View>
      ) : null}
      {m.text ? (
        isUser
          ? <Text style={[styles.bubbleText, { color: '#fff' }]}>{m.text}</Text>
          : <Markdown text={m.text} />
      ) : null}
      {!isUser && m.text && (
        <Pressable
          onPress={() => speak(stripMarkdown(m.text), lang)}
          hitSlop={6} style={styles.speakBtn}>
          <Ionicons name="volume-high-outline" size={16} color={colors.textMuted} />
          <Text style={styles.speakBtnText}>{tr('tutor.read')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Plain text for TTS — strips Markdown so the synth doesn't say "hash hash".
function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/>\s?/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  menuBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { flex: 1, fontSize: font.body, fontWeight: '800', color: colors.text, lineHeight: font.body + 8 },
  keyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.amberSoft, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  keyBannerText: { color: '#92400E', fontSize: font.small, fontWeight: '600' },
  welcome: { alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.sm },
  welcomeAvatar: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  welcomeTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, textAlign: 'center' },
  welcomeSub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', marginTop: 4, maxWidth: 280 },
  suggestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  suggestionText: { fontSize: font.small, color: colors.text, fontWeight: '600', flex: 1 },
  bubble: { maxWidth: '85%', padding: spacing.md, borderRadius: radius.lg },
  user: { backgroundColor: colors.accent, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistant: { backgroundColor: colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4, ...shadow.soft },
  bubbleText: { fontSize: font.body, color: colors.text, lineHeight: 22 },
  typing: { fontSize: font.body, color: colors.textFaint, fontStyle: 'italic' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, height: 44, backgroundColor: colors.bgAlt, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 0, fontSize: font.body, color: colors.text },
  sendBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  plusBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  attachWrap: { backgroundColor: colors.surface, paddingTop: spacing.sm },
  attachItem: { width: 64, height: 64 },
  attachThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.bgAlt },
  attachRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: colors.surface, borderRadius: 10 },
  attachHint: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600', paddingHorizontal: spacing.md, paddingTop: 6 },
  bubbleImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  bubbleImage: { width: 120, height: 120, borderRadius: 10 },
  chooserBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  chooserSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  chooserHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  chooserTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  chooserItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  chooserItemText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  chooserCancel: { paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  chooserCancelText: { fontSize: font.body, fontWeight: '700', color: colors.textMuted },
  pickErrBox: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: colors.amber },
  pickErrText: { color: colors.text, fontSize: font.small, fontWeight: '600' },
  speakBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', opacity: 0.7 },
  speakBtnText: { fontSize: font.tiny, color: colors.textMuted, fontWeight: '600' },
  histBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  histPanel: { width: '82%', maxWidth: 360, backgroundColor: colors.surface, paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderRightWidth: 1, borderRightColor: colors.border },
  histHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  // give the title generous line-height so čáry/diacritics (ě, š, í) don't get clipped on Android/web
  histTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, lineHeight: font.h3 + 12, includeFontPadding: true },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.primary, marginBottom: spacing.md },
  newChatText: { color: '#fff', fontWeight: '800', fontSize: font.body, lineHeight: font.body + 6 },
  histEmpty: { textAlign: 'center', color: colors.textFaint, fontSize: font.small, marginTop: spacing.lg, fontWeight: '600', lineHeight: font.small + 8 },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md, marginBottom: 6 },
  threadRowActive: { backgroundColor: colors.primarySoft },
  threadTitle: { fontSize: font.small, fontWeight: '700', color: colors.text, lineHeight: font.small + 8 },
  threadPreview: { fontSize: font.tiny, color: colors.textMuted, marginTop: 3, lineHeight: font.tiny + 6 },
});
