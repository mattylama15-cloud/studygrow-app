// Persistence layer on top of AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from './types';

// v2: bumped to drop the old sample/seed data that early testers had saved on device.
const KEY = 'studygrow:state:v2';

export async function loadState(): Promise<Partial<AppState> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppState>;
  } catch (e) {
    console.warn('Failed to load state', e);
    return null;
  }
}

export async function saveState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (e) {
    console.warn('Failed to clear state', e);
  }
}
