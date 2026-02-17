import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants';

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabaseConfigSummary = (): string => {
  if (!isSupabaseConfigured()) {
    return 'Supabase non configurato: usa .env con URL + anon key.';
  }
  return 'Supabase configurato: pronto per integrazione realtime/SQL RLS.';
};
