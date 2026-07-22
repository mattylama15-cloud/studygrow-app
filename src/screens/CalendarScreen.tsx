import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing, deckColors, shadow } from '../theme';
import { Button, Card, ScreenScroll, StackHeader, EmptyState, SectionHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { todayKey, shortDate, relativeDay, daysBetween } from '../utils';
import { Exam, Task } from '../types';
import { useT } from '../i18n';

const WEEKDAY_KEYS = ['calendar.wd.mon', 'calendar.wd.tue', 'calendar.wd.wed', 'calendar.wd.thu', 'calendar.wd.fri', 'calendar.wd.sat', 'calendar.wd.sun'];
const MONTH_KEYS = ['calendar.month.1', 'calendar.month.2', 'calendar.month.3', 'calendar.month.4', 'calendar.month.5', 'calendar.month.6', 'calendar.month.7', 'calendar.month.8', 'calendar.month.9', 'calendar.month.10', 'calendar.month.11', 'calendar.month.12'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function isoFor(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function monthMatrix(year: number, month: number): (string | null)[] {
  // 6 rows × 7 cols, Monday-first
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoFor(year, month, d));
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function CalendarScreen() {
  const { state, addTask, toggleTask, deleteTask, addExam, deleteExam } = useApp();
  const { t, lang } = useT();
  const nav = useNav();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selectedISO, setSelectedISO] = useState<string>(today);
  const [createOpen, setCreateOpen] = useState(false);

  const matrix = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor]);

  // Markers by date — number of tasks/exams on that day, used to dot the calendar cell.
  const marks = useMemo(() => {
    const m: Record<string, { tasks: number; exams: number; doneAll: boolean }> = {};
    for (const t of state.tasks) {
      m[t.dateISO] = m[t.dateISO] || { tasks: 0, exams: 0, doneAll: true };
      m[t.dateISO].tasks += 1;
      if (!t.done) m[t.dateISO].doneAll = false;
    }
    for (const e of state.exams) {
      m[e.dateISO] = m[e.dateISO] || { tasks: 0, exams: 0, doneAll: true };
      m[e.dateISO].exams += 1;
    }
    return m;
  }, [state.tasks, state.exams]);

  const dayTasks = state.tasks.filter((t) => t.dateISO === selectedISO);
  const dayExams = state.exams.filter((e) => e.dateISO === selectedISO);
  const upcoming = useMemo(() => state.exams
    .filter((e) => daysBetween(today, e.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, 3), [state.exams, today]);

  const prevMonth = () => setCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 });
  const nextMonth = () => setCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 });

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('calendar.title')} onBack={nav.pop} right={
        <Pressable onPress={() => setCreateOpen(true)} hitSlop={8}>
          <Ionicons name="add-circle" size={26} color={colors.primary} />
        </Pressable>
      } />
      <ScreenScroll>
        {/* Month header */}
        <View style={styles.monthBar}>
          <Pressable onPress={prevMonth} hitSlop={10}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
          <Text style={styles.monthTitle}>{t(MONTH_KEYS[cursor.m])} {cursor.y}</Text>
          <Pressable onPress={nextMonth} hitSlop={10}><Ionicons name="chevron-forward" size={22} color={colors.text} /></Pressable>
        </View>

        {/* Weekday labels */}
        <View style={styles.weekRow}>
          {WEEKDAY_KEYS.map((w, i) => (
            <Text key={w} style={[styles.weekDay, (i === 5 || i === 6) && { color: colors.textMuted }]}>{t(w)}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {matrix.map((iso, i) => {
            const isToday = iso === today;
            const isSelected = iso === selectedISO;
            const m = iso ? marks[iso] : undefined;
            const day = iso ? Number(iso.slice(-2)) : '';
            return (
              <Pressable key={i} onPress={() => iso && setSelectedISO(iso)} style={[
                styles.cell,
                isSelected && styles.cellSelected,
                isToday && !isSelected && styles.cellToday,
              ]}>
                {iso ? (
                  <>
                    <Text style={[styles.cellDay, isSelected && { color: '#fff' }, isToday && !isSelected && { color: colors.primary, fontWeight: '800' }]}>{day}</Text>
                    {m && (
                      <View style={styles.cellDots}>
                        {m.exams > 0 && <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : colors.danger }]} />}
                        {m.tasks > 0 && <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : (m.doneAll ? colors.success : colors.amber) }]} />}
                      </View>
                    )}
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* Selected day */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {shortDate(selectedISO, lang)} · {relativeDay(selectedISO, lang)}
          </Text>
          <Pressable onPress={() => setCreateOpen(true)} style={styles.addInline} hitSlop={6}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addInlineText}>{t('common.add')}</Text>
          </Pressable>
        </View>

        {dayExams.length === 0 && dayTasks.length === 0 ? (
          <EmptyState icon="calendar-clear-outline" title={t('calendar.emptyTitle')} subtitle={t('calendar.emptySub')} />
        ) : null}

        {dayExams.map((ex) => (
          <Card key={ex.id} style={{ marginBottom: 8, borderLeftWidth: 4, borderLeftColor: ex.color }}>
            <View style={styles.itemRow}>
              <View style={styles.examBadge}><Ionicons name="school" size={14} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{ex.title}</Text>
                {ex.subject ? <Text style={styles.itemSub}>{ex.subject} · {t('calendar.examLower')}</Text> : <Text style={styles.itemSub}>{t('calendar.exam')}</Text>}
              </View>
              <Pressable onPress={() => deleteExam(ex.id)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
            </View>
          </Card>
        ))}

        {dayTasks.map((t) => (
          <Card key={t.id} style={{ marginBottom: 8 }}>
            <View style={styles.itemRow}>
              <Pressable onPress={() => toggleTask(t.id)} style={[styles.checkbox, t.done && { backgroundColor: colors.primary, borderColor: colors.primary }]} hitSlop={6}>
                {t.done && <Ionicons name="checkmark" size={14} color="#fff" />}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, t.done && { textDecorationLine: 'line-through', color: colors.textMuted }]}>{t.title}</Text>
                {t.note ? <Text style={styles.itemSub} numberOfLines={2}>{t.note}</Text> : null}
              </View>
              <Pressable onPress={() => deleteTask(t.id)} hitSlop={8}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
            </View>
          </Card>
        ))}

        {upcoming.length > 0 && (
          <>
            <SectionHeader title={t('calendar.upcomingExams')} />
            {upcoming.map((ex) => {
              const d = daysBetween(today, ex.dateISO);
              return (
                <Card key={ex.id} style={{ marginBottom: 8 }} onPress={() => { setSelectedISO(ex.dateISO); setCursor({ y: Number(ex.dateISO.slice(0, 4)), m: Number(ex.dateISO.slice(5, 7)) - 1 }); }}>
                  <View style={styles.itemRow}>
                    <View style={[styles.examBadge, { backgroundColor: ex.color }]}><Ionicons name="school" size={14} color="#fff" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{ex.title}</Text>
                      <Text style={styles.itemSub}>{shortDate(ex.dateISO, lang)} · {t(d === 1 ? 'calendar.inDays1' : d < 5 ? 'calendar.inDays2' : 'calendar.inDays5', { n: d })}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </ScreenScroll>

      <CreateModal visible={createOpen} initialISO={selectedISO} onClose={() => setCreateOpen(false)}
        onCreateTask={(title, dateISO, note) => { addTask({ title, dateISO, note }); setCreateOpen(false); }}
        onCreateExam={(title, subject, dateISO, color) => { addExam({ title, subject, dateISO, color }); setCreateOpen(false); }} />
    </View>
  );
}

function CreateModal({ visible, initialISO, onClose, onCreateTask, onCreateExam }: {
  visible: boolean; initialISO: string; onClose: () => void;
  onCreateTask: (title: string, dateISO: string, note?: string) => void;
  onCreateExam: (title: string, subject: string | undefined, dateISO: string, color: string) => void;
}) {
  const { t } = useT();
  const [kind, setKind] = useState<'task' | 'exam'>('task');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');
  const [dateISO, setDateISO] = useState(initialISO);
  const [color, setColor] = useState(deckColors[0]);

  React.useEffect(() => { if (visible) { setKind('task'); setTitle(''); setSubject(''); setNote(''); setDateISO(initialISO); setColor(deckColors[0]); } }, [visible, initialISO]);

  const valid = !!title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dateISO);
  const create = () => {
    if (!valid) return;
    if (kind === 'task') onCreateTask(title.trim(), dateISO, note.trim() || undefined);
    else onCreateExam(title.trim(), subject.trim() || undefined, dateISO, color);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.kindRow}>
            <Pressable onPress={() => setKind('task')} style={[styles.kindBtn, kind === 'task' && styles.kindBtnActive]}>
              <Ionicons name="checkbox-outline" size={18} color={kind === 'task' ? '#fff' : colors.textMuted} />
              <Text style={[styles.kindText, kind === 'task' && { color: '#fff' }]}>{t('calendar.kindTask')}</Text>
            </Pressable>
            <Pressable onPress={() => setKind('exam')} style={[styles.kindBtn, kind === 'exam' && styles.kindBtnActive]}>
              <Ionicons name="school-outline" size={18} color={kind === 'exam' ? '#fff' : colors.textMuted} />
              <Text style={[styles.kindText, kind === 'exam' && { color: '#fff' }]}>{t('calendar.exam')}</Text>
            </Pressable>
          </View>

          <TextInput value={title} onChangeText={setTitle} placeholder={kind === 'task' ? t('calendar.taskPlaceholder') : t('calendar.examNamePlaceholder')} placeholderTextColor={colors.textFaint} style={styles.input} autoFocus />
          <View style={{ height: 8 }} />

          {kind === 'exam' ? (
            <TextInput value={subject} onChangeText={setSubject} placeholder={t('calendar.subjectPlaceholder')} placeholderTextColor={colors.textFaint} style={styles.input} />
          ) : (
            <TextInput value={note} onChangeText={setNote} placeholder={t('calendar.notePlaceholder')} placeholderTextColor={colors.textFaint} style={[styles.input, { minHeight: 60 }]} multiline />
          )}
          <View style={{ height: 8 }} />
          <DateField value={dateISO} onChange={setDateISO} />

          {kind === 'exam' && (
            <>
              <Text style={styles.pickLabel}>{t('calendar.color')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {deckColors.map((c) => (
                  <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorPick, { backgroundColor: c }, color === c && styles.colorPickActive]} />
                ))}
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title={t('common.add')} icon="checkmark" onPress={create} disabled={!valid} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { t } = useT();
  if (Platform.OS === 'web') {
    return (
      <View>
        <Text style={styles.pickLabel}>{t('calendar.date')}</Text>
        {/* @ts-ignore — RN-web passes <input type> through */}
        <input type="date" value={value} onChange={(e: any) => onChange(e.target.value)}
          style={{ background: colors.surfaceMuted, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, color: colors.text, width: '100%', fontFamily: 'inherit' as any }} />
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.pickLabel}>{t('calendar.dateManual')}</Text>
      <TextInput value={value ? formatHuman(value) : ''} onChangeText={(v) => onChange(parseHuman(v))}
        placeholder={t('calendar.datePlaceholder')} placeholderTextColor={colors.textFaint} style={styles.input} keyboardType="numbers-and-punctuation" />
    </View>
  );
}
function formatHuman(iso: string): string { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function parseHuman(s: string): string { const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/); if (!m) return s; let [, d, mo, y] = m; if (y.length === 2) y = '20' + y; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; }

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  monthTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text },
  weekRow: { flexDirection: 'row', marginTop: spacing.sm, marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: font.tiny, color: colors.textFaint, fontWeight: '800', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  cellSelected: { backgroundColor: colors.primary, borderRadius: radius.md },
  cellToday: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md },
  cellDay: { fontSize: font.small, color: colors.text, fontWeight: '600' },
  cellDots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm },
  dayTitle: { fontSize: font.body, fontWeight: '800', color: colors.text },
  addInline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  addInlineText: { color: colors.primary, fontWeight: '800', fontSize: font.small },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  itemSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  examBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.md },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  kindBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  kindBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  kindText: { fontWeight: '800', color: colors.textMuted, fontSize: font.small },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: font.body, color: colors.text },
  pickLabel: { fontSize: font.small, fontWeight: '700', color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  colorPick: { width: 36, height: 36, borderRadius: 9999 },
  colorPickActive: { borderWidth: 3, borderColor: colors.text },
});
