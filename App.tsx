import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/state/AppContext';
import { FocusTimerProvider } from './src/state/FocusTimer';
import { Navigator } from './src/navigation/Navigator';
import { PlantGraphic } from './src/components/PlantGraphic';
import { colors } from './src/theme';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

function Gate() {
  const { hydrated, state } = useApp();
  // Tracks whether the user dismissed onboarding this session even before the
  // persisted flag has flushed back to AsyncStorage on slow devices.
  const [dismissed, setDismissed] = useState(false);
  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <PlantGraphic growth={0.7} size={120} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
      </View>
    );
  }
  if (!state.settings.onboardingDone && !dismissed) {
    return <OnboardingScreen onDone={() => setDismissed(true)} />;
  }
  return <Navigator />;
}

function Shell() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <FocusTimerProvider>
          <StatusBar style="dark" />
          <Gate />
        </FocusTimerProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  // On a desktop browser, show the app inside a 9:16 phone frame so it looks like
  // a mobile. On a real phone (narrow) or in Expo Go it fills the screen normally.
  const desktopWeb = Platform.OS === 'web' && width >= 600;

  if (desktopWeb) {
    return (
      <View style={styles.page}>
        <View style={styles.phone}>
          <Shell />
        </View>
      </View>
    );
  }
  return <Shell />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  page: { flex: 1, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  phone: {
    height: '96%',
    aspectRatio: 9 / 16,
    maxWidth: '100%',
    backgroundColor: colors.bg,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 8,
    borderColor: '#000000',
  },
});
