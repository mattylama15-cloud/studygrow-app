import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';
import { Button, Card, ScreenScroll, StackHeader, EmptyState } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { useT } from '../i18n';

export function NotesScreen() {
  const { state, addNote } = useApp();
  const nav = useNav();
  const { t, lang } = useT();

  const newNote = () => {
    const n = addNote();
    nav.push('NoteEditor', { noteId: n.id });
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('notes.title')} onBack={nav.pop} right={
        <Ionicons name="add" size={26} color={colors.primary} onPress={newNote} />
      } />
      <ScreenScroll contentStyle={{ paddingTop: 4 }}>
        {state.notes.length === 0 ? (
          <EmptyState icon="document-text-outline" title={t('notes.empty')} subtitle={t('notes.emptySub')} />
        ) : (
          state.notes.map((n) => (
            <Card key={n.id} style={{ marginBottom: 10 }} onPress={() => nav.push('NoteEditor', { noteId: n.id })}>
              <Text style={styles.noteTitle} numberOfLines={1}>{n.title || t('note.untitled')}</Text>
              <Text style={styles.noteBody} numberOfLines={2}>{n.body || t('notes.emptyNote')}</Text>
              <Text style={styles.noteDate}>{new Date(n.updatedAt).toLocaleDateString(lang)}</Text>
            </Card>
          ))
        )}
        <Button title={t('notes.new')} icon="add" variant="secondary" onPress={newNote} style={{ marginTop: 6 }} />
      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  noteTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  noteBody: { fontSize: font.small, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  noteDate: { fontSize: font.tiny, color: colors.textFaint, marginTop: 8 },
});
