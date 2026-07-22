import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, radius, spacing, shadow } from '../theme';
import { Button, Card, StackHeader, EmptyState } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { useT } from '../i18n';

// "Study with me" — lobby místností (classroomů).
// Vytvoříš místnost → dostaneš kód → sdílíš ho. Připojíš se kódem. Otevřeš detail,
// kde sdílíš kartičky/poznámky/kvízy a píšeš v chatu. Vše lokálně (AsyncStorage),
// sdílení mezi zařízeními přijde se serverem.

const ROOM_EMOJIS = ['📚', '🧠', '🔬', '📐', '🌍', '🎨', '💻', '⚗️', '📖', '🎯'];

export function StudyTogetherScreen() {
  const { state, createClassroom, joinClassroom } = useApp();
  const { t } = useT();
  const nav = useNav();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const rooms = state.classrooms;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StackHeader title={t('together.title')} onBack={() => nav.pop()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>

        <Card style={styles.hero}>
          <Text style={styles.heroEmoji}>👯</Text>
          <Text style={styles.heroTitle}>{t('together.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('together.heroSub')}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md, width: '100%' }}>
            <Button title={t('together.createRoom')} icon="add-circle" onPress={() => setCreateOpen(true)} style={{ flex: 1 }} />
            <Button title={t('together.joinByCode')} icon="key" variant="secondary" onPress={() => setJoinOpen(true)} style={{ flex: 1 }} />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>{t('together.myRooms')}</Text>
        {rooms.length === 0 ? (
          <EmptyState icon="people-outline" title={t('together.emptyTitle')} subtitle={t('together.emptySub')} />
        ) : (
          rooms.map((r) => (
            <Card key={r.id} style={{ marginBottom: 10 }} onPress={() => nav.push('Classroom', { roomId: r.id })}>
              <View style={styles.roomRow}>
                <Text style={styles.roomEmoji}>{r.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.roomMeta}>
                    {t('together.roomCode', { code: r.code })} · {t(r.members.length === 1 ? 'together.members1' : 'together.members5', { n: r.members.length })} · {t('together.sharedCount', { n: r.decks.length + r.notes.length + r.quizzes.length })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <CreateRoomModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(name, emoji) => {
          const room = createClassroom(name, emoji);
          setCreateOpen(false);
          nav.push('Classroom', { roomId: room.id });
        }}
      />
      <JoinRoomModal
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoin={(code) => {
          const res = joinClassroom(code);
          if (res.ok && res.room) {
            setJoinOpen(false);
            nav.push('Classroom', { roomId: res.room.id });
          }
          return res;
        }}
      />
    </View>
  );
}

function CreateRoomModal({ visible, onClose, onCreate }: {
  visible: boolean; onClose: () => void; onCreate: (name: string, emoji: string) => void;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(ROOM_EMOJIS[0]);
  React.useEffect(() => { if (visible) { setName(''); setEmoji(ROOM_EMOJIS[0]); } }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('together.newRoomTitle')}</Text>
          <Text style={styles.sheetSub}>{t('together.newRoomSub')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('together.roomNamePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoFocus
            maxLength={40}
          />
          <View style={styles.emojiRow}>
            {ROOM_EMOJIS.map((e) => (
              <Pressable key={e} onPress={() => setEmoji(e)} style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}>
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('together.create')} icon="checkmark" onPress={() => onCreate(name, emoji)} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function JoinRoomModal({ visible, onClose, onJoin }: {
  visible: boolean; onClose: () => void; onJoin: (code: string) => { ok: boolean; reason?: string };
}) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  React.useEffect(() => { if (visible) { setCode(''); setErr(null); } }, [visible]);

  const submit = () => {
    const res = onJoin(code);
    if (!res.ok) setErr(res.reason || t('together.joinFailed'));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('together.joinTitle')}</Text>
          <Text style={styles.sheetSub}>{t('together.joinSub')}</Text>
          <TextInput
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setErr(null); }}
            placeholder={t('together.codePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.codeInput]}
            autoFocus
            autoCapitalize="characters"
            maxLength={6}
          />
          {err && <Text style={styles.err}>{err}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('together.join')} icon="enter" onPress={submit} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: font.h2, fontWeight: '800', color: colors.text },
  heroSub: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', lineHeight: font.small + 6, paddingHorizontal: spacing.sm },
  sectionTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomEmoji: { fontSize: 30 },
  roomName: { fontSize: font.body, fontWeight: '800', color: colors.text },
  roomMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.accentLine },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md, lineHeight: font.small + 6 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: font.body, color: colors.text },
  codeInput: { fontSize: font.h2, fontWeight: '800', textAlign: 'center', letterSpacing: 6 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  emojiBtn: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  emojiBtnActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  err: { color: colors.danger, fontSize: font.small, marginTop: 8, fontWeight: '600' },
});
