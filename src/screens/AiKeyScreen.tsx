import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, font, radius, spacing } from '../theme';
import { Button, Card, ScreenScroll, StackHeader } from '../components/ui';
import { useApp } from '../state/AppContext';
import { useNav } from '../navigation/Navigator';
import { resolveKey } from '../ai/client';
import { useT } from '../i18n';

// Groq keys look like "gsk_" followed by letters/numbers.
const KEY_RE = /gsk_[A-Za-z0-9]{20,}/;

// Friendly, no-password screen so ANY user can connect their own free Groq key.
// (The password-gated Admin panel still exists for the owner under "Pokročilé".)
export function AiKeyScreen() {
  const { state, updateSettings } = useApp();
  const { t } = useT();
  const nav = useNav();
  const { settings } = state;

  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [clipKey, setClipKey] = useState<string | null>(null); // key spotted in clipboard
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const active = !!resolveKey(apiKey.trim() || settings.apiKey);

  const save = (v: string) => {
    setApiKey(v);
    updateSettings({ apiKey: v.trim() || null });
  };

  // Best-effort: when the screen opens, peek at the clipboard. If it holds a Groq
  // key (the user just copied it on Groq), offer one-tap paste. May be blocked on
  // web without a gesture — then the manual "Vložit ze schránky" button covers it.
  useEffect(() => {
    let alive = true;
    Clipboard.getStringAsync()
      .then((txt) => {
        const found = txt?.match(KEY_RE)?.[0];
        if (alive && found && found !== apiKey.trim()) setClipKey(found);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pasteFromClipboard = async () => {
    setPasteMsg(null);
    try {
      const txt = await Clipboard.getStringAsync();
      const found = txt?.match(KEY_RE)?.[0];
      if (found) { save(found); setClipKey(null); setPasteMsg(t('aikey.pasted')); }
      else setPasteMsg(t('aikey.noKeyInClipboard'));
    } catch {
      setPasteMsg(t('aikey.clipboardFailed'));
    }
  };

  const useClipKey = () => { if (clipKey) { save(clipKey); setClipKey(null); setPasteMsg(t('aikey.pasted')); } };

  const STEPS = [
    t('aikey.step1'),
    t('aikey.step2'),
    t('aikey.step3'),
  ];

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={t('aikey.title')} onBack={nav.pop} />
      <ScreenScroll contentStyle={{ paddingTop: 4 }}>
        <View style={[styles.statusRow, { backgroundColor: active ? colors.primarySoft : colors.amberSoft }]}>
          <Ionicons name={active ? 'checkmark-circle' : 'sparkles'} size={20} color={active ? colors.primary : colors.amber} />
          <Text style={[styles.statusText, { color: active ? colors.primaryDark : '#92400E' }]}>
            {active ? t('aikey.statusOn') : t('aikey.statusOff')}
          </Text>
        </View>

        <Text style={styles.lead}>
          {t('aikey.lead')}
        </Text>

        <Card style={{ gap: spacing.md }}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
          <Button title={t('aikey.getKey')} icon="open-outline"
            onPress={() => Linking.openURL('https://console.groq.com/keys')} />
        </Card>

        <Text style={styles.section}>{t('aikey.yourKey')}</Text>

        {clipKey && (
          <Pressable onPress={useClipKey} style={styles.clipBanner}>
            <Ionicons name="clipboard" size={18} color={colors.primary} />
            <Text style={styles.clipText}>{t('aikey.clipFound')}</Text>
            <Ionicons name="arrow-forward-circle" size={20} color={colors.primary} />
          </Pressable>
        )}

        <Card>
          <View style={styles.keyRow}>
            <TextInput value={apiKey} onChangeText={save}
              placeholder="gsk_…" placeholderTextColor={colors.textFaint} secureTextEntry={!showKey}
              autoCapitalize="none" autoCorrect={false} style={[styles.input, { flex: 1 }]} />
            <Pressable onPress={() => setShowKey((s) => !s)} hitSlop={8} style={styles.eyeBtn}>
              <Ionicons name={showKey ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <Button title={t('aikey.pasteFromClipboard')} icon="clipboard-outline" variant="secondary" onPress={pasteFromClipboard} />
          {pasteMsg ? <Text style={styles.pasteMsg}>{pasteMsg}</Text> : null}
          <Text style={styles.help}>{t('aikey.privacyHelp')}</Text>
        </Card>

        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={18} color={colors.accent} />
          <Text style={styles.tipText}>
            {t('aikey.limitTip')}
          </Text>
        </View>

      </ScreenScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  statusText: { fontSize: font.small, fontWeight: '700', flex: 1 },
  lead: { fontSize: font.small, color: colors.textMuted, lineHeight: 20, marginTop: spacing.lg, marginBottom: spacing.md, paddingHorizontal: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { color: colors.primary, fontWeight: '800', fontSize: font.small },
  stepText: { flex: 1, fontSize: font.small, color: colors.text, lineHeight: 20 },
  section: { fontSize: font.small, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: 4 },
  input: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: font.body, color: colors.text },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  eyeBtn: { padding: 8 },
  clipBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  clipText: { flex: 1, fontSize: font.small, fontWeight: '700', color: colors.primaryDark },
  pasteMsg: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, fontWeight: '600' },
  help: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 17 },
  tipBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  tipText: { flex: 1, fontSize: font.tiny, color: colors.textMuted, lineHeight: 17 },
  advanced: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl, padding: spacing.sm },
  advancedText: { fontSize: font.tiny, color: colors.textFaint, fontWeight: '600' },
});
