import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, BackHandler, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, font, spacing } from '../theme';

import { HomeScreen } from '../screens/HomeScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { DecksScreen } from '../screens/DecksScreen';
import { TutorScreen } from '../screens/TutorScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

import { DeckDetailScreen } from '../screens/DeckDetailScreen';
import { StudyScreen } from '../screens/StudyScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AiKeyScreen } from '../screens/AiKeyScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { QuizSetupScreen } from '../screens/QuizSetupScreen';
import { StudyTogetherScreen } from '../screens/StudyTogetherScreen';
import { ClassroomScreen } from '../screens/ClassroomScreen';
import { useT } from '../i18n';

export type TabName = 'Home' | 'Focus' | 'Decks' | 'Tutor' | 'Profile';
export type Route = { name: string; params?: Record<string, any> };

type NavCtx = {
  tab: TabName;
  setTab: (t: TabName) => void;
  push: (name: string, params?: Record<string, any>) => void;
  pop: () => void;
  popToRoot: () => void;
};

const Ctx = createContext<NavCtx | null>(null);
export function useNav() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav outside provider');
  return c;
}

const TABS: { name: TabName; icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { name: 'Home', icon: 'home', labelKey: 'tab.home' },
  { name: 'Focus', icon: 'timer', labelKey: 'tab.focus' },
  { name: 'Decks', icon: 'albums', labelKey: 'tab.decks' },
  { name: 'Tutor', icon: 'sparkles', labelKey: 'tab.tutor' },
];

const TAB_SCREENS: Record<TabName, React.ComponentType> = {
  Home: HomeScreen,
  Focus: FocusScreen,
  Decks: DecksScreen,
  Tutor: TutorScreen,
  Profile: ProfileScreen,
};

const STACK_SCREENS: Record<string, React.ComponentType<{ params?: Record<string, any> }>> = {
  DeckDetail: DeckDetailScreen,
  Study: StudyScreen,
  Quiz: QuizScreen,
  Notes: NotesScreen,
  NoteEditor: NoteEditorScreen,
  Settings: SettingsScreen,
  AiKey: AiKeyScreen,
  Coach: CoachScreen,
  Calendar: CalendarScreen,
  QuizSetup: QuizSetupScreen,
  StudyTogether: StudyTogetherScreen,
  Classroom: ClassroomScreen,
};

export function Navigator() {
  const { t: tr } = useT();
  const [tab, setTabState] = useState<TabName>('Home');
  const [stack, setStack] = useState<Route[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  // Tab, ze kterého jsme na aktuální tab přišli. Umožní zobrazit šipku zpět
  // na Kartičkách/Focusu, když se tam uživatel proklikl z Domů.
  const insets = useSafeAreaInsets();

  const setTab = useCallback((t: TabName) => {
    Haptics.selectionAsync().catch(() => {});
    setStack([]);
    setTabState(t);
  }, []);
  const push = useCallback((name: string, params?: Record<string, any>) => {
    setStack((s) => [...s, { name, params }]);
  }, []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const popToRoot = useCallback(() => setStack([]), []);

  // Android hardware back
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) {
        setStack((s) => s.slice(0, -1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const value = useMemo<NavCtx>(() => ({ tab, setTab, push, pop, popToRoot }), [tab, setTab, push, pop, popToRoot]);

  const TabComp = TAB_SCREENS[tab];
  const top = stack[stack.length - 1];
  const StackComp = top ? STACK_SCREENS[top.name] : null;

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* base tab screen */}
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <TabComp />
        </SafeAreaView>

        {/* tab bar (hidden while a modal/stack screen is open) */}
        {!top && <TabBar tab={tab} onSelect={setTab} onMore={() => setMenuOpen(true)} />}

        {/* stack overlay */}
        {StackComp && (
          <View style={StyleSheet.absoluteFill}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
              <StackComp params={top!.params} />
            </SafeAreaView>
          </View>
        )}

        {/* Jazykové kolečko je teď součástí hlavičky na HomeScreen. */}

        {/* bottom "…" menu (Profil / Nastavení), Duolingo-style */}
        <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
            <View style={[styles.menuSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
              <View style={styles.menuHandle} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setTab('Profile'); }}>
                <Ionicons name="person-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>{tr('menu.profile')}</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); push('Settings'); }}>
                <Ionicons name="settings-outline" size={22} color={colors.text} />
                <Text style={styles.menuText}>{tr('menu.settings')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Ctx.Provider>
  );
}

function TabBar({ tab, onSelect, onMore }: { tab: TabName; onSelect: (t: TabName) => void; onMore: () => void }) {
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();
  const moreActive = tab === 'Profile';
  return (
    <View style={[styles.tabBarWrap, { paddingBottom: Math.max(insets.bottom, 22) }]}>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.name === tab;
          return (
            <Pressable key={t.name} style={styles.tabItem} onPress={() => onSelect(t.name)}>
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <Ionicons name={active ? t.icon : (`${t.icon}-outline` as any)} size={22} color={active ? colors.primary : colors.textFaint} />
              </View>
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.textFaint }]}>{tr(t.labelKey)}</Text>
            </Pressable>
          );
        })}
        {/* "…" — opens Profil / Nastavení menu (replaces the Profile tab) */}
        <Pressable style={styles.tabItem} onPress={onMore}>
          <View style={[styles.tabIcon, moreActive && styles.tabIconActive]}>
            <Ionicons name="ellipsis-horizontal" size={22} color={moreActive ? colors.primary : colors.textFaint} />
          </View>
          <Text style={[styles.tabLabel, { color: moreActive ? colors.primary : colors.textFaint }]}>{tr('tab.more')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // `top` se dopočítá podle bezpečné zóny — přepínač zůstává pevně nad obsahem.
  menuSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.accentLine, paddingTop: spacing.sm, ...shadow.card },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: spacing.lg },
  menuText: { fontSize: font.body, fontWeight: '700', color: colors.text },
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  tabBarWrap: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  tabBar: { flexDirection: 'row', paddingTop: 8, paddingBottom: 6, paddingHorizontal: 6 },
  tabItem: { flex: 1, alignItems: 'center', gap: 3 },
  tabIcon: { width: 46, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: colors.primarySoft },
  tabLabel: { fontSize: 11, fontWeight: '700' },
});
