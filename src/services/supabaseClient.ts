import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants';

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const isNodeTestRuntime = (): boolean =>
  typeof window === 'undefined' &&
  typeof document === 'undefined' &&
  typeof process !== 'undefined' &&
  Boolean((process as { versions?: { node?: string } }).versions?.node);

export const createSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured() || isNodeTestRuntime()) {
    return null;
  }

  return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
};

export const supabase = createSupabaseClient();
