import { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { supabase } from './supabaseClient';

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase non configurato. Controlla EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  return supabase;
};

export const signUpWithEmail = async (email: string, password: string) => {
  const client = requireSupabase();
  return client.auth.signUp({
    email,
    password,
  });
};

export const signInWithEmail = async (email: string, password: string) => {
  const client = requireSupabase();
  return client.auth.signInWithPassword({
    email,
    password,
  });
};

export const signOut = async () => {
  const client = requireSupabase();
  return client.auth.signOut();
};

export const getCurrentSession = async (): Promise<Session | null> => {
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  return data.session;
};

export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void
) => {
  const client = requireSupabase();
  return client.auth.onAuthStateChange(callback);
};
