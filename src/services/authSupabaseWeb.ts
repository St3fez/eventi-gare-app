import { EVENT_WEB_BASE_URL } from '../constants';
import { cleanText } from '../utils/format';

type AuthResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: string;
    };

export type OrganizerEmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

export type WebAuthClientLike = {
  auth: {
    exchangeCodeForSession: (
      code: string
    ) => Promise<{
      error: {
        message: string;
      } | null;
    }>;
    setSession: (session: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{
      error: {
        message: string;
      } | null;
    }>;
    verifyOtp: (params: {
      token_hash: string;
      type: OrganizerEmailOtpType;
    }) => Promise<{
      error: {
        message: string;
      } | null;
    }>;
  };
};

export type ParsedAuthCallback = {
  hasAuthCallbackParams: boolean;
  errorMessage: string | null;
  code: string | null;
  tokenHash: string | null;
  rawType: string | null;
  otpType: OrganizerEmailOtpType | null;
  accessToken: string | null;
  refreshToken: string | null;
};

const SUPPORTED_EMAIL_OTP_TYPES = new Set<OrganizerEmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

const authFail = <T>(reason: string): AuthResult<T> => ({
  ok: false,
  reason,
});

export const normalizeWebAuthRedirectUrl = (
  value: string | null | undefined
): string | undefined => {
  const candidate = cleanText(value ?? '');
  if (!candidate) {
    return undefined;
  }

  try {
    const parsed = new URL(candidate);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return undefined;
    }

    const normalizedPath = parsed.pathname
      .replace(/\/(?:index\.html?|404\.html?)$/i, '')
      .replace(/\/+$/, '');

    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return undefined;
  }
};

export const getWebAuthRedirectUrl = (
  runtimeUrl?: string | null
): string | undefined => {
  const configuredBase = normalizeWebAuthRedirectUrl(EVENT_WEB_BASE_URL);
  if (configuredBase) {
    return configuredBase;
  }

  const runtimeCandidate =
    runtimeUrl ??
    (typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : undefined);
  return normalizeWebAuthRedirectUrl(runtimeCandidate);
};

const getUrlParams = (url: string): {
  searchParams: URLSearchParams;
  hashParams: URLSearchParams;
} | null => {
  try {
    const parsed = new URL(url);
    return {
      searchParams: parsed.searchParams,
      hashParams: new URLSearchParams(parsed.hash.replace(/^#/, '')),
    };
  } catch {
    return null;
  }
};

const readAuthParam = (
  searchParams: URLSearchParams,
  hashParams: URLSearchParams,
  key: string
): string | null => searchParams.get(key) ?? hashParams.get(key);

const isSupportedEmailOtpType = (
  value: string | null
): value is OrganizerEmailOtpType =>
  Boolean(value) && SUPPORTED_EMAIL_OTP_TYPES.has(value as OrganizerEmailOtpType);

export const parseAuthCallbackUrl = (url: string): ParsedAuthCallback => {
  const params = getUrlParams(url);
  if (!params) {
    return {
      hasAuthCallbackParams: false,
      errorMessage: null,
      code: null,
      tokenHash: null,
      rawType: null,
      otpType: null,
      accessToken: null,
      refreshToken: null,
    };
  }

  const code = readAuthParam(params.searchParams, params.hashParams, 'code');
  const tokenHash = readAuthParam(params.searchParams, params.hashParams, 'token_hash');
  const rawType = readAuthParam(params.searchParams, params.hashParams, 'type');
  const accessToken = readAuthParam(params.searchParams, params.hashParams, 'access_token');
  const refreshToken = readAuthParam(params.searchParams, params.hashParams, 'refresh_token');
  const error = readAuthParam(params.searchParams, params.hashParams, 'error');
  const errorCode = readAuthParam(params.searchParams, params.hashParams, 'error_code');
  const errorDescription = readAuthParam(
    params.searchParams,
    params.hashParams,
    'error_description'
  );
  const errorMessage = [errorDescription, errorCode, error]
    .filter((entry): entry is string => Boolean(entry))
    .join(' | ');

  return {
    hasAuthCallbackParams: Boolean(
      code || tokenHash || accessToken || refreshToken || error || errorCode || errorDescription
    ),
    errorMessage: errorMessage || null,
    code,
    tokenHash,
    rawType,
    otpType: isSupportedEmailOtpType(rawType) ? rawType : null,
    accessToken,
    refreshToken,
  };
};

export const hasAuthCallbackParams = (url: string): boolean =>
  parseAuthCallbackUrl(url).hasAuthCallbackParams;

export const completeWebAuthFromUrl = async (
  url: string,
  client: WebAuthClientLike
): Promise<AuthResult<boolean>> => {
  const callback = parseAuthCallbackUrl(url);

  if (!callback.hasAuthCallbackParams) {
    return {
      ok: true,
      data: false,
    };
  }

  if (callback.errorMessage) {
    return authFail(`Autenticazione web fallita: ${callback.errorMessage}`);
  }

  if (callback.code) {
    const exchanged = await client.auth.exchangeCodeForSession(callback.code);
    if (exchanged.error) {
      return authFail(`Scambio code OAuth fallito: ${exchanged.error.message}`);
    }
    return {
      ok: true,
      data: true,
    };
  }

  if (callback.tokenHash) {
    if (!callback.otpType) {
      const typeMessage = callback.rawType
        ? `Tipo callback non supportato: ${callback.rawType}.`
        : 'Parametro type mancante.';
      return authFail(`Magic Link non valido. ${typeMessage}`);
    }

    const verified = await client.auth.verifyOtp({
      token_hash: callback.tokenHash,
      type: callback.otpType,
    });
    if (verified.error) {
      return authFail(`Verifica Magic Link fallita: ${verified.error.message}`);
    }

    return {
      ok: true,
      data: true,
    };
  }

  if (!callback.accessToken || !callback.refreshToken) {
    return authFail('Callback di autenticazione incompleto.');
  }

  const sessionSet = await client.auth.setSession({
    access_token: callback.accessToken,
    refresh_token: callback.refreshToken,
  });
  if (sessionSet.error) {
    return authFail(`Sessione OAuth non applicata: ${sessionSet.error.message}`);
  }
  return {
    ok: true,
    data: true,
  };
};
