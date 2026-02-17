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
