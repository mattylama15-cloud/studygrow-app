import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadow } from '../theme';

// Default gray profile avatar. Rendered once globally by the Navigator and pinned
// to fixed top-right coordinates, so it sits at the exact same X/Y on every screen.
export function ProfileAvatar({ onPress, icon = 'person' }: { onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.avatar}>
      <Ionicons name={icon} size={22} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
});
