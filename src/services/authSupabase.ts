import { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Linking, Platform } from 'react-native';

import {
  completeWebAuthFromUrl,
  getWebAuthRedirectUrl,
  type WebAuthClientLike,
} from './authSupabaseWeb';
import { supabase } from './supabaseClient';

const SUPABASE_CONFIG_ERROR =
  'Supabase non configurato. Controlla EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY';

const requireSupabase = () => {
  if (!supabase) {
    throw new Error(SUPABASE_CONFIG_ERROR);
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

export const requestEmailOtp = async (email: string, shouldCreateUser = true) => {
  const client = requireSupabase();
  const session = await client.auth.getSession();
  if (session.data.session?.user?.is_anonymous) {
    const signOut = await client.auth.signOut();
    if (signOut.error) {
      throw new Error(`Impossibile uscire dalla sessione anonima: ${signOut.error.message}`);
    }
  }
  const redirectTo = getRedirectTo();
  return client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
      emailRedirectTo: redirectTo,
    },
  });
};

export const verifyEmailOtp = async (email: string, token: string) => {
  const client = requireSupabase();
  return client.auth.verifyOtp({
    email,
    token,
    type: 'email',
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

type AuthResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: string;
    };

export type OrganizerSecurityStatus = {
  userId: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  providers: string[];
  socialProvider: 'google' | null;
  isAnonymous: boolean;
  securityReady: boolean;
};

const authFail = <T>(reason: string): AuthResult<T> => ({
  ok: false,
  reason,
});

const parseOrganizerSecurity = (
  session: Session | null
): AuthResult<OrganizerSecurityStatus> => {
  if (!session?.user) {
    return authFail('Nessuna sessione attiva.');
  }

  const user = session.user;
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
        .map((entry) => String(entry).toLowerCase())
        .filter(Boolean)
    : [];
  const socialProvider = providers.includes('google') ? 'google' : null;
  const hasEmailProvider = providers.includes('email') || Boolean(user.email);
  const hasNonAnonymousProvider = providers.some((provider) => provider !== 'anonymous');
  const isAnonymous = Boolean(user.is_anonymous) && !hasNonAnonymousProvider && !hasEmailProvider;
  const phoneVerified = Boolean(user.phone_confirmed_at);
  const status: OrganizerSecurityStatus = {
    userId: user.id,
    email: user.email ?? '',
    phone: user.phone ?? '',
    phoneVerified,
    providers,
    socialProvider,
    isAnonymous,
    securityReady: !isAnonymous && (Boolean(socialProvider) || hasEmailProvider),
  };

  return {
    ok: true,
    data: status,
  };
};

export const getOrganizerSecurityStatus = async (): Promise<
  AuthResult<OrganizerSecurityStatus>
> => {
  const client = supabase;
  if (!client) {
    return authFail(SUPABASE_CONFIG_ERROR);
  }
  const result = await client.auth.getSession();
  if (result.error) {
    return authFail(`Lettura sessione fallita: ${result.error.message}`);
  }

  const currentSession = result.data.session;
  if (!currentSession?.access_token) {
    return parseOrganizerSecurity(currentSession);
  }

  const validatedUser = await client.auth.getUser(currentSession.access_token);
  if (validatedUser.error || !validatedUser.data.user) {
    await client.auth.signOut();
    return authFail('Sessione non valida o account non piu disponibile. Effettua di nuovo login.');
  }

  return parseOrganizerSecurity({
    ...currentSession,
    user: validatedUser.data.user,
  });
};

const getRedirectTo = (): string | undefined => {
  if (Platform.OS === 'web') {
    return getWebAuthRedirectUrl();
  }
  return 'eventigare://auth/callback';
};

export const startOrganizerOAuth = async (provider: 'google'): Promise<AuthResult<null>> => {
  const client = supabase;
  if (!client) {
    return authFail(SUPABASE_CONFIG_ERROR);
  }
  const redirectTo = getRedirectTo();

  const session = await client.auth.getSession();
  if (session.data.session?.user?.is_anonymous) {
    await client.auth.signOut();
  }

  const response = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (response.error) {
    return authFail(`Login ${provider} fallito: ${response.error.message}`);
  }

  if (Platform.OS !== 'web' && response.data?.url) {
    const canOpen = await Linking.canOpenURL(response.data.url);
    if (!canOpen) {
      return authFail('Impossibile aprire il browser per OAuth.');
    }
    await Linking.openURL(response.data.url);
  }

  return {
    ok: true,
    data: null,
  };
};

export { getWebAuthRedirectUrl, hasAuthCallbackParams } from './authSupabaseWeb';

export const completeOAuthFromUrl = async (
  url: string,
  clientOverride?: WebAuthClientLike
): Promise<AuthResult<boolean>> => {
  const client = clientOverride ?? supabase;
  if (!client) {
    return authFail(SUPABASE_CONFIG_ERROR);
  }
  return completeWebAuthFromUrl(url, client);
};

export const requestOrganizerPhoneOtp = async (phone: string): Promise<AuthResult<null>> => {
  const client = requireSupabase();
  const session = await client.auth.getSession();
  if (session.error) {
    return authFail(`Lettura sessione fallita: ${session.error.message}`);
  }
  if (!session.data.session?.user) {
    return authFail('Effettua prima login Google.');
  }

  const normalizedPhone = phone.trim();
  if (!normalizedPhone) {
    return authFail('Numero telefono mancante.');
  }

  const updated = await client.auth.updateUser({
    phone: normalizedPhone,
  });
  if (updated.error) {
    return authFail(`Invio OTP fallito: ${updated.error.message}`);
  }

  return {
    ok: true,
    data: null,
  };
};

export const verifyOrganizerPhoneOtp = async (
  phone: string,
  token: string
): Promise<AuthResult<null>> => {
  const client = requireSupabase();
  const normalizedPhone = phone.trim();
  const normalizedToken = token.trim();
  if (!normalizedPhone || !normalizedToken) {
    return authFail('Numero telefono o codice OTP mancanti.');
  }

  const verifyPhoneChange = await client.auth.verifyOtp({
    phone: normalizedPhone,
    token: normalizedToken,
    type: 'phone_change',
  });

  if (!verifyPhoneChange.error) {
    return {
      ok: true,
      data: null,
    };
  }

  const verifySms = await client.auth.verifyOtp({
    phone: normalizedPhone,
    token: normalizedToken,
    type: 'sms',
  });

  if (verifySms.error) {
    return authFail(`Verifica OTP fallita: ${verifySms.error.message}`);
  }

  return {
    ok: true,
    data: null,
  };
};
