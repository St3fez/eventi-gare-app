import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEY } from '../constants';
import { AppData } from '../types';
import { normalizeData } from '../utils/format';

export const loadAppData = async (fallback: AppData): Promise<AppData> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    return normalizeData(JSON.parse(stored) as Partial<AppData>, fallback);
  } catch {
    return fallback;
  }
};

export const saveAppData = async (data: AppData): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const LANGUAGE_STORAGE_KEY = `${STORAGE_KEY}:language`;

export const loadLanguagePreference = async (): Promise<'it' | 'en' | null> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'it' || stored === 'en' ? stored : null;
  } catch {
    return null;
  }
};

export const saveLanguagePreference = async (language: 'it' | 'en'): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Preference is a convenience: ignore storage failures.
  }
};
