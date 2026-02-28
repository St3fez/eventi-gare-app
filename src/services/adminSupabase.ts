import { AdminUser } from '../types';
import { cleanText } from '../utils/format';
import { supabase } from './supabaseClient';
import { ensureSupabaseUser } from './supabaseData';

type SyncResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: string;
    };

const fail = <T>(reason: string): SyncResult<T> => ({
  ok: false,
  reason,
});

type AdminUserRow = {
  email: string;
  can_manage_admins: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const ADMIN_SELECT = 'email,can_manage_admins,active,created_at,updated_at';

const normalizeEmail = (value: string): string => cleanText(value).toLowerCase();

const mapAdminRow = (row: AdminUserRow): AdminUser => ({
  email: row.email,
  canManageAdmins: row.can_manage_admins,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getAdminAccessByEmail = async (email: string): Promise<
  SyncResult<{
    isAdmin: boolean;
    canManageAdmins: boolean;
  }>
> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return {
      ok: true,
      data: {
        isAdmin: false,
        canManageAdmins: false,
      },
    };
  }

  const auth = await ensureSupabaseUser({ allowAnonymous: false });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select('email,can_manage_admins,active')
    .eq('email', normalizedEmail)
    .maybeSingle<{ email: string; can_manage_admins: boolean; active: boolean }>();

  if (error) {
    return fail(`Lettura accesso admin fallita: ${error.message}`);
  }

  if (!data || !data.active) {
    return {
      ok: true,
      data: {
        isAdmin: false,
        canManageAdmins: false,
      },
    };
  }

  return {
    ok: true,
    data: {
      isAdmin: true,
      canManageAdmins: Boolean(data.can_manage_admins),
    },
  };
};

export const listAdminUsers = async (): Promise<SyncResult<AdminUser[]>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser({ allowAnonymous: false });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const { data, error } = await supabase
    .from('admin_users')
    .select(ADMIN_SELECT)
    .order('active', { ascending: false })
    .order('email', { ascending: true });

  if (error) {
    return fail(`Lettura admin fallita: ${error.message}`);
  }

  return {
    ok: true,
    data: ((data ?? []) as AdminUserRow[]).map(mapAdminRow),
  };
};

export const grantAdminUser = async (payload: {
  email: string;
  canManageAdmins: boolean;
}): Promise<SyncResult<AdminUser>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser({ allowAnonymous: false });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const normalizedEmail = normalizeEmail(payload.email);
  if (!normalizedEmail.includes('@')) {
    return fail('Email admin non valida.');
  }

  const { data, error } = await supabase
    .from('admin_users')
    .upsert(
      {
        email: normalizedEmail,
        can_manage_admins: payload.canManageAdmins,
        active: true,
      },
      {
        onConflict: 'email',
      }
    )
    .select(ADMIN_SELECT)
    .single<AdminUserRow>();

  if (error || !data) {
    return fail(`Assegnazione admin fallita: ${error?.message ?? 'dati mancanti'}`);
  }

  return {
    ok: true,
    data: mapAdminRow(data),
  };
};

export const revokeAdminUser = async (email: string): Promise<SyncResult<AdminUser>> => {
  if (!supabase) {
    return fail('Supabase non configurato.');
  }

  const auth = await ensureSupabaseUser({ allowAnonymous: false });
  if (!auth.ok) {
    return fail(auth.reason);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes('@')) {
    return fail('Email admin non valida.');
  }

  const { data, error } = await supabase
    .from('admin_users')
    .update({
      active: false,
    })
    .eq('email', normalizedEmail)
    .select(ADMIN_SELECT)
    .single<AdminUserRow>();

  if (error || !data) {
    return fail(`Revoca admin fallita: ${error?.message ?? 'utente non trovato'}`);
  }

  return {
    ok: true,
    data: mapAdminRow(data),
  };
};
