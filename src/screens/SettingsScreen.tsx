import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing, THEME_PRESETS } from '../theme';
import { Button, Card, ScreenScroll, StackHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { GROWTH_THEMES, GrowthGraphic } from '../components/GrowthGraphics';
import { useT } from '../i18n';

const GOALS = [30, 60, 90, 120];

export function SettingsScreen() {
  const { state, updateSettings, resetAll } = useApp();
  const { t } = useT();
  const nav = useNav();
  const { settings } = state;
  const [name, setName] = useState(settings.name || '');
  const [resetOpen, setResetOpen] = useState(false);
  const [themeToast, setThemeToast] = useState<string | null>(null);

  const setTheme = (id: string) => {
    updateSettings({ themeColor: id });
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('studygrow:theme', id); } catch {}
    if (Platform.OS === 'web') {
      setTimeout(() => { try { (window as any).location.reload(); } catch {} }, 250);
    } else {
      setThemeToast(t('settings.themeSavedToast'));
      setTimeout(() => setThemeToast(null), 3500);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('settings.title')} onBack={nav.pop} />
      <ScreenScroll contentStyle={{ paddingTop: 4 }}>
        {/* Profile */}
        <Text style={styles.section}>{t('settings.profile')}</Text>
        <Card>
          <Text style={styles.label}>{t('settings.name')}</Text>
          <TextInput value={name} onChangeText={(v) => { setName(v); updateSettings({ name: v }); }}
            placeholder={t('settings.namePlaceholder')} placeholderTextColor={colors.textFaint} style={styles.input} />
        </Card>

        {/* Appearance color */}
        <Text style={styles.section}>{t('settings.appColor')}</Text>
        <View style={styles.colorGrid}>
          {THEME_PRESETS.map((p) => {
            const active = (settings.themeColor || 'green') === p.id;
            return (
              <Pressable key={p.id} onPress={() => setTheme(p.id)} style={styles.swatchWrap}>
                <View style={[styles.colorSwatch, { backgroundColor: p.swatch }, p.dark && { borderWidth: 3, borderColor: p.primary }, active && styles.colorSwatchActive]}>
                  {active ? <Ionicons name="checkmark" size={20} color={p.dark ? p.primary : '#fff'} /> : null}
                </View>
                <Text style={styles.swatchLabel} numberOfLines={1}>{t(`color.${p.id}`)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>{t('settings.appColorHelp')}</Text>

        {/* Daily goal */}
        <Text style={styles.section}>{t('settings.dailyGoal')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {GOALS.map((g) => (
            <Pressable key={g} onPress={() => updateSettings({ dailyGoalMinutes: g })}
              style={[styles.goalPick, settings.dailyGoalMinutes === g && styles.goalPickActive]}>
              <Text style={[styles.goalText, settings.dailyGoalMinutes === g && { color: '#fff' }]}>{g}m</Text>
            </Pressable>
          ))}
        </View>

        {/* Focus theme */}
        <Text style={styles.section}>{t('settings.focusTheme')}</Text>
        <View style={styles.themeGrid}>
          {GROWTH_THEMES.map((gt) => {
            const active = settings.focusTheme === gt.id;
            return (
              <Pressable key={gt.id} onPress={() => updateSettings({ focusTheme: gt.id })}
                style={[styles.themeCard, active && styles.themeCardActive]}>
                <GrowthGraphic themeId={gt.id} progress={0.85} size={54} />
                <Text style={[styles.themeLabel, active && { color: colors.primaryDark }]}>{t(gt.labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* AI / Admin */}
        <Text style={styles.section}>{t('settings.aiTutor')}</Text>
        <Card onPress={() => nav.push('AiKey')}>
          <View style={styles.modelRow}>
            <View style={styles.adminIcon}><Ionicons name="sparkles" size={18} color={colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modelLabel}>{t('settings.connectAi')}</Text>
              <Text style={styles.modelId}>{t('settings.connectAiSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
        </Card>

        {/* Data */}
        <Text style={styles.section}>{t('settings.data')}</Text>
        <Text style={styles.help}>{t('settings.dataHelp')}</Text>
        <View style={{ height: 8 }} />
        <Button title={t('settings.wipeAll')} icon="trash" variant="danger" onPress={() => setResetOpen(true)} />

        <Text style={styles.footer}>{t('settings.footer')}</Text>

        {themeToast && (
          <View style={styles.toast}><Text style={styles.toastText}>{themeToast}</Text></View>
        )}
      </ScreenScroll>

      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => setResetOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setResetOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('settings.wipeConfirmTitle')}</Text>
            <Text style={styles.sheetSub}>{t('settings.wipeConfirmSub')}</Text>
            <Button title={t('settings.wipe')} icon="trash" variant="danger" onPress={() => { setResetOpen(false); resetAll(); }} />
            <View style={{ height: 8 }} />
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setResetOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: font.small, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: 4 },
  label: { fontSize: font.small, fontWeight: '700', color: colors.text, marginBottom: 6 },
  help: { fontSize: font.tiny, color: colors.textMuted, marginBottom: spacing.sm, lineHeight: 17 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: font.body, color: colors.text },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { padding: 8 },
  linkOut: { color: colors.accent, fontSize: font.small, fontWeight: '700', marginTop: spacing.md },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeCard: { width: '31%', alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  themeCardActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  themeLabel: { fontSize: font.tiny, fontWeight: '700', color: colors.text, marginTop: 2 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  swatchWrap: { width: '31%', alignItems: 'center', marginBottom: spacing.md },
  swatchLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 5, textAlign: 'center' },
  colorSwatch: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  colorSwatchActive: { borderWidth: 3, borderColor: colors.text },
  goalPick: { flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  goalPickActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  goalText: { fontWeight: '800', color: colors.textMuted },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  adminIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  modelLabel: { fontSize: font.body, fontWeight: '700', color: colors.text },
  modelId: { fontSize: font.tiny, color: colors.textFaint, marginTop: 2 },
  footer: { textAlign: 'center', color: colors.textFaint, fontSize: font.tiny, marginTop: spacing.xxl },
  toast: { position: 'absolute' as const, bottom: 20, left: 16, right: 16, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md },
  toastText: { color: colors.primaryDark, fontSize: font.small, fontWeight: '700', textAlign: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accentLine, borderRadius: radius.xl, padding: spacing.lg },
  sheetTitle: { fontSize: font.h3, fontWeight: '800', color: colors.text, marginBottom: 4 },
  sheetSub: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 19 },
  dataMsgBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  dataMsgOk: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  dataMsgErr: { backgroundColor: '#3a1212', borderColor: colors.danger },
  dataMsgInfo: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  dataMsgText: { color: colors.text, fontSize: font.small, fontWeight: '600', lineHeight: 19 },
});
