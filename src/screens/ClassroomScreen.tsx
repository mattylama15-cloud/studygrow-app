import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { colors, font, radius, spacing, shadow } from '../theme';
import { Button, Card, StackHeader, EmptyState, Pill } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { timeAgo } from '../utils';
import { useT } from '../i18n';

type Tab = 'content' | 'chat';

export function ClassroomScreen({ params }: { params?: Record<string, any> }) {
  const nav = useNav();
  const { t, lang } = useT();
  const {
    state, leaveClassroom, postRoomMessage, removeSharedItem,
    shareDeckToRoom, shareNoteToRoom, addDeck, addCards,
  } = useApp();

  const roomId: string = params?.roomId;
  const room = state.classrooms.find((r) => r.id === roomId);

  const [tab, setTab] = useState<Tab>('content');
  const [shareOpen, setShareOpen] = useState<null | 'deck' | 'note'>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const chatRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (tab === 'chat') setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 50);
  }, [tab, room?.messages.length]);

  if (!room) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <StackHeader title={t('classroom.room')} onBack={() => nav.pop()} />
        <EmptyState icon="alert-circle-outline" title={t('classroom.notFound')} subtitle={t('classroom.notFoundSub')} />
      </View>
    );
  }

  const copyCode = async () => {
    await Clipboard.setStringAsync(room.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sharedCount = room.decks.length + room.notes.length + room.quizzes.length;

  // Naimportuje sdílený balíček do MÝCH balíčků (zkopíruje kartičky).
  const importDeck = (title: string, emoji: string, color: string, cards: { front: string; back: string }[]) => {
    const deck = addDeck({ title, emoji, color });
    if (cards.length) addCards(deck.id, cards);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader
        title={`${room.emoji} ${room.name}`}
        onBack={() => nav.pop()}
        right={
          <Pressable onPress={() => setConfirmLeave(true)} hitSlop={8}>
            <Ionicons name="exit-outline" size={22} color={colors.danger} />
          </Pressable>
        }
      />

      {/* Kód místnosti */}
      <View style={styles.codeBar}>
        <View>
          <Text style={styles.codeLabel}>{t('classroom.joinCode')}</Text>
          <Text style={styles.codeValue}>{room.code}</Text>
        </View>
        <Button title={copied ? t('classroom.copied') : t('classroom.copyCode')} icon={copied ? 'checkmark' : 'copy'} small variant="secondary" onPress={copyCode} />
      </View>

      {/* Členové */}
      <View style={styles.membersRow}>
        {room.members.map((m, i) => (
          <View key={i} style={styles.memberChip}>
            <Text style={{ fontSize: 14 }}>{m.emoji}</Text>
            <Text style={styles.memberName}>{m.name}{m.you ? ` ${t('classroom.youSuffix')}` : ''}</Text>
          </View>
        ))}
      </View>

      {/* Taby */}
      <View style={styles.tabs}>
        <TabButton label={`${t('classroom.tabContent')}${sharedCount ? ` (${sharedCount})` : ''}`} active={tab === 'content'} onPress={() => setTab('content')} />
        <TabButton label={t('classroom.tabChat')} active={tab === 'chat'} onPress={() => setTab('chat')} />
      </View>

      {tab === 'content' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
            <Button title={t('classroom.shareDeck')} icon="albums" small onPress={() => setShareOpen('deck')} style={{ flex: 1 }} />
            <Button title={t('classroom.shareNote')} icon="document-text" small variant="secondary" onPress={() => setShareOpen('note')} style={{ flex: 1 }} />
          </View>

          {sharedCount === 0 ? (
            <EmptyState icon="cube-outline" title={t('classroom.emptyTitle')} subtitle={t('classroom.emptySub')} />
          ) : (
            <>
              {room.decks.map((d) => (
                <Card key={d.id} style={{ marginBottom: 10 }}>
                  <View style={styles.itemRow}>
                    <Text style={{ fontSize: 26 }}>{d.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{d.title}</Text>
                      <Text style={styles.itemMeta}>{t('classroom.deckMeta', { n: d.cards.length, who: d.sharedBy })} · {timeAgo(d.ts, lang)}</Text>
                    </View>
                    <Pressable onPress={() => removeSharedItem(room.id, 'deck', d.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                  <Button title={t('classroom.saveToMine')} icon="download" small variant="secondary" style={{ marginTop: 10 }}
                    onPress={() => importDeck(d.title, d.emoji, d.color, d.cards)} />
                </Card>
              ))}
              {room.notes.map((n) => (
                <Card key={n.id} style={{ marginBottom: 10 }}>
                  <View style={styles.itemRow}>
                    <Text style={{ fontSize: 26 }}>📝</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{n.title || t('classroom.untitled')}</Text>
                      <Text style={styles.itemMeta}>{t('classroom.noteMeta', { who: n.sharedBy })} · {timeAgo(n.ts, lang)}</Text>
                    </View>
                    <Pressable onPress={() => removeSharedItem(room.id, 'note', n.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
                    </Pressable>
                  </View>
                  <Text style={styles.notePreview} numberOfLines={3}>{n.body}</Text>
                </Card>
              ))}
            </>
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView ref={chatRef} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            {room.messages.map((m) => (
              m.system ? (
                <Text key={m.id} style={styles.systemMsg}>{m.text}</Text>
              ) : (
                <View key={m.id} style={[styles.msgBubble, m.author === (state.settings.name?.trim() || 'Ty') && styles.msgMine]}>
                  <Text style={styles.msgAuthor}>{m.author}</Text>
                  <Text style={styles.msgText}>{m.text}</Text>
                </View>
              )
            ))}
          </ScrollView>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.composer}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t('classroom.messagePlaceholder')}
                placeholderTextColor={colors.textFaint}
                style={styles.composerInput}
                onSubmitEditing={() => { postRoomMessage(room.id, draft); setDraft(''); }}
                returnKeyType="send"
              />
              <Pressable onPress={() => { postRoomMessage(room.id, draft); setDraft(''); }} style={styles.sendBtn}>
                <Ionicons name="send" size={18} color={colors.onPrimary} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Sdílení mého obsahu */}
      <SharePickerModal
        kind={shareOpen}
        onClose={() => setShareOpen(null)}
        onPickDeck={(deckId) => {
          const deck = state.decks.find((d) => d.id === deckId);
          if (!deck) return;
          const cards = state.cards.filter((c) => c.deckId === deckId).map((c) => ({ front: c.front, back: c.back }));
          shareDeckToRoom(room.id, { title: deck.title, emoji: deck.emoji, color: deck.color, cards });
          setShareOpen(null);
        }}
        onPickNote={(noteId) => {
          const note = state.notes.find((n) => n.id === noteId);
          if (!note) return;
          shareNoteToRoom(room.id, { title: note.title, body: note.body });
          setShareOpen(null);
        }}
      />

      <Modal visible={confirmLeave} transparent animationType="fade" onRequestClose={() => setConfirmLeave(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmLeave(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('classroom.leaveTitle')}</Text>
            <Text style={styles.sheetSub}>{t('classroom.leaveSub')}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
              <Button title={t('common.stay')} variant="secondary" onPress={() => setConfirmLeave(false)} style={{ flex: 1 }} />
              <Button title={t('classroom.leave')} variant="danger" onPress={() => { leaveClassroom(room.id); nav.pop(); }} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SharePickerModal({ kind, onClose, onPickDeck, onPickNote }: {
  kind: null | 'deck' | 'note';
  onClose: () => void;
  onPickDeck: (id: string) => void;
  onPickNote: (id: string) => void;
}) {
  const { state } = useApp();
  const { t } = useT();
  const visible = kind !== null;
  const decks = state.decks;
  const notes = state.notes;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.sheetTitle}>{kind === 'deck' ? t('classroom.pickDeck') : t('classroom.pickNote')}</Text>
          <ScrollView style={{ maxHeight: 360, marginTop: spacing.md }}>
            {kind === 'deck' && (decks.length === 0
              ? <Text style={styles.pickerEmpty}>{t('classroom.noDecks')}</Text>
              : decks.map((d) => {
                  const count = state.cards.filter((c) => c.deckId === d.id).length;
                  return (
                    <Pressable key={d.id} onPress={() => onPickDeck(d.id)} style={styles.pickerRow}>
                      <Text style={{ fontSize: 24 }}>{d.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{d.title}</Text>
                        <Text style={styles.itemMeta}>{t('classroom.cardCount', { n: count })}</Text>
                      </View>
                      <Ionicons name="share-outline" size={20} color={colors.primary} />
                    </Pressable>
                  );
                }))}
            {kind === 'note' && (notes.length === 0
              ? <Text style={styles.pickerEmpty}>{t('classroom.noNotes')}</Text>
              : notes.map((n) => (
                  <Pressable key={n.id} onPress={() => onPickNote(n.id)} style={styles.pickerRow}>
                    <Text style={{ fontSize: 24 }}>📝</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{n.title || t('classroom.untitled')}</Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>{n.body.slice(0, 50)}</Text>
                    </View>
                    <Ionicons name="share-outline" size={20} color={colors.primary} />
                  </Pressable>
                )))}
          </ScrollView>
          <Button title={t('common.close')} variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  codeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.primarySoft, marginHorizontal: spacing.lg, borderRadius: radius.md, marginTop: 4 },
  codeLabel: { fontSize: font.tiny, color: colors.primaryDark, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  codeValue: { fontSize: font.h2, fontWeight: '800', color: colors.primaryDark, letterSpacing: 4, marginTop: 2 },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  memberName: { fontSize: font.tiny, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { fontWeight: '800', color: colors.textMuted, fontSize: font.small },
  tabTextActive: { color: colors.primaryDark },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  itemMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  notePreview: { fontSize: font.small, color: colors.textMuted, marginTop: 10, lineHeight: font.small + 5 },
  systemMsg: { fontSize: font.tiny, color: colors.textFaint, textAlign: 'center', marginVertical: 8, fontStyle: 'italic' },
  msgBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.md, padding: 10, marginVertical: 4, maxWidth: '85%', alignSelf: 'flex-start' },
  msgMine: { backgroundColor: colors.primarySoft, borderColor: colors.primary, alignSelf: 'flex-end' },
  msgAuthor: { fontSize: font.tiny, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  msgText: { fontSize: font.small, color: colors.text, lineHeight: font.small + 5 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  composerInput: { flex: 1, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, fontSize: font.body, color: colors.text },
  sendBtn: { width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentLine },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginTop: 4, lineHeight: font.small + 6 },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.accentLine, padding: spacing.lg, paddingBottom: spacing.xl },
  pickerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerEmpty: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
});
