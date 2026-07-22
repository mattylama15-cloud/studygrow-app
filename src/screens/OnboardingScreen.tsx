import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing, isDark } from '../theme';
import { useApp } from '../state/AppContext';
import { useT } from '../i18n';

const { width, height } = Dimensions.get('window');

// Each slide has its own warm gradient pair + accent that tints the headline,
// the progress dots and the CTA. Soft pastel halos behind the icon give it depth.
type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  titleKey: string;
  bodyKey: string;
  bg: readonly [string, string];
  ring: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'leaf',
    emoji: '🌱',
    titleKey: 'onboarding.s1.title',
    bodyKey: 'onboarding.s1.body',
    bg: ['#0F2A1E', '#06150F'] as const,
    ring: '#22C55E',
    accent: '#86EFAC',
  },
  {
    icon: 'albums',
    emoji: '🃏',
    titleKey: 'onboarding.s2.title',
    bodyKey: 'onboarding.s2.body',
    bg: ['#1A1F3A', '#0B0F22'] as const,
    ring: '#6366F1',
    accent: '#A5B4FC',
  },
  {
    icon: 'timer',
    emoji: '⏱️',
    titleKey: 'onboarding.s3.title',
    bodyKey: 'onboarding.s3.body',
    bg: ['#2A1A0E', '#160B05'] as const,
    ring: '#F59E0B',
    accent: '#FCD34D',
  },
  {
    icon: 'sparkles',
    emoji: '✨',
    titleKey: 'onboarding.s4.title',
    bodyKey: 'onboarding.s4.body',
    bg: ['#2A1235', '#150818'] as const,
    ring: '#A855F7',
    accent: '#D8B4FE',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { updateSettings } = useApp();
  const { t } = useT();
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const last = idx === SLIDES.length - 1;

  // Each slide fades and gently lifts in. The icon also floats up and down forever.
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(20)).current;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0); lift.setValue(20);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [idx]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const finish = () => { updateSettings({ onboardingDone: true }); onDone(); };
  const next = () => (last ? finish() : setIdx((i) => i + 1));
  const back = () => idx > 0 && setIdx((i) => i - 1);

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.45] });

  const heroSize = Math.min(280, Math.min(width, height) * 0.6);

  return (
    <View style={styles.root}>
      <LinearGradient colors={slide.bg as [string, string]} style={StyleSheet.absoluteFill} />

      {/* faint orbs in the background for warmth */}
      <View style={[styles.orb, { backgroundColor: slide.ring, top: -80, right: -60, opacity: 0.18 }]} />
      <View style={[styles.orb, { backgroundColor: slide.accent, bottom: -100, left: -80, opacity: 0.12, width: 240, height: 240 }]} />

      {/* top bar */}
      <View style={styles.topBar}>
        <View style={{ width: 60 }}>
          {idx > 0 && (
            <Pressable onPress={back} hitSlop={10}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </Pressable>
          )}
        </View>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && { backgroundColor: slide.accent, width: 22 }]} />
          ))}
        </View>
        <Pressable onPress={finish} hitSlop={10} style={{ width: 60, alignItems: 'flex-end' }}>
          <Text style={styles.skip}>{last ? '' : t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      {/* hero icon */}
      <Animated.View style={[styles.heroWrap, { opacity: fade, transform: [{ translateY: lift }] }]}>
        <View style={{ width: heroSize, height: heroSize, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[styles.haloOuter, { backgroundColor: slide.ring, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <View style={[styles.haloInner, { borderColor: slide.ring }]} />
          <Animated.Text style={[styles.emoji, { transform: [{ translateY: floatY }] }]}>{slide.emoji}</Animated.Text>
        </View>
      </Animated.View>

      {/* text */}
      <Animated.View style={[styles.text, { opacity: fade, transform: [{ translateY: lift }] }]}>
        <Text style={[styles.title, { color: slide.accent }]}>{t(slide.titleKey)}</Text>
        <Text style={styles.body}>{t(slide.bodyKey)}</Text>
      </Animated.View>

      {/* CTA */}
      <View style={styles.footer}>
        <Pressable onPress={next} style={({ pressed }) => [styles.cta, { backgroundColor: slide.ring, opacity: pressed ? 0.85 : 1 }]}>
          <Text style={styles.ctaText}>{last ? t('onboarding.start') : t('common.continue')}</Text>
          <Ionicons name={last ? 'rocket' : 'arrow-forward'} size={20} color="#0B0F22" style={{ marginLeft: 6 }} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  orb: { position: 'absolute', width: 320, height: 320, borderRadius: 9999 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  skip: { color: 'rgba(255,255,255,0.7)', fontSize: font.small, fontWeight: '700' },

  heroWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  haloOuter: { position: 'absolute', width: '100%', height: '100%', borderRadius: 9999 },
  haloInner: { position: 'absolute', width: '74%', height: '74%', borderRadius: 9999, borderWidth: 1.5, opacity: 0.5 },
  emoji: { fontSize: 130, textAlign: 'center' },

  text: { alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.xl },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: -0.5 },
  body: { fontSize: 17, color: 'rgba(255,255,255,0.82)', textAlign: 'center', lineHeight: 25, maxWidth: 460 },

  footer: { paddingBottom: spacing.sm },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, borderRadius: radius.lg, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  ctaText: { fontSize: 17, fontWeight: '800', color: '#0B0F22', letterSpacing: 0.2 },
});
