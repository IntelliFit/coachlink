import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env.production' });

type UserProfile = {
  id: string;
  nickname: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
};

type UserRow = {
  id: string;
  phone: string | null;
  email: string | null;
  created_at: string | null;
  last_login_at: string | null;
  // PostgREST embed may return:
  // - null (no related row)
  // - object (one-to-one)
  // - array (one-to-many)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_profiles?: any;
};

type ReportRow = {
  user_id: string;
  phone: string | null;
  email: string | null;
  user_created_at: string | null;
  last_login_at: string | null;
  profile_id: string | null;
  old_nickname: string | null;
  new_nickname: string | null;
  action: 'inserted_profile' | 'updated_nickname' | 'no_change' | 'skipped_no_phone' | 'error';
  error?: string;
};

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function last4Phone(phone: string) {
  return phone.slice(-4);
}

function pickProfile(u: UserRow): UserProfile | null {
  const raw = (u as any).user_profiles;
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as UserProfile) || null;
  return raw as UserProfile;
}

async function fetchAllUsers(serviceRoleSupabase: any): Promise<UserRow[]> {
  const pageSize = 1000;
  const all: UserRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await serviceRoleSupabase
      .from('users')
      .select('id, phone, email, created_at, last_login_at, user_profiles!left(id, nickname, onboarding_completed, created_at)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as any));
    if (data.length < pageSize) break;
  }

  return all;
}

async function main() {
  const serviceKey =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      'Missing service role key. Please set NEXT_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local/.env.development.',
    );
  }

  // IMPORTANT: load dotenv BEFORE creating supabase clients.
  // We must dynamically import the client after dotenv.config() to avoid "supabaseUrl is required".
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { serviceRoleSupabase } = await import('../src/lib/supabaseClient');

  const users = await fetchAllUsers(serviceRoleSupabase as any);

  const isBad = (u: UserRow) => {
    const p = pickProfile(u);
    return !p || !p.nickname || p.nickname.trim() === '';
  };

  const badUsers = users.filter(isBad);
  const badWithPhone = badUsers.filter((u) => !!u.phone);
  const badNoPhone = badUsers.filter((u) => !u.phone);

  const reportRows: ReportRow[] = [];

  // Pre-fill report rows for no-phone users (cannot derive nickname)
  for (const u of badNoPhone) {
    const p = pickProfile(u);
    reportRows.push({
      user_id: u.id,
      phone: u.phone,
      email: u.email,
      user_created_at: u.created_at,
      last_login_at: u.last_login_at,
      profile_id: p?.id ?? null,
      old_nickname: p?.nickname ?? null,
      new_nickname: null,
      action: 'skipped_no_phone',
    });
  }

  const limit = pLimit(10);

  const tasks = badWithPhone.map((u) =>
    limit(async () => {
      const p = pickProfile(u);
      const desired = last4Phone(u.phone as string);

      try {
        if (!p) {
          const nowIso = new Date().toISOString();
          const { data: inserted, error: insErr } = await serviceRoleSupabase
            .from('user_profiles')
            .insert({
              user_id: u.id,
              nickname: desired,
              onboarding_completed: false,
              bio: '',
              created_at: nowIso,
              updated_at: nowIso,
            } as any)
            .select('id, nickname')
            .single();

          if (insErr) throw insErr;

          reportRows.push({
            user_id: u.id,
            phone: u.phone,
            email: u.email,
            user_created_at: u.created_at,
            last_login_at: u.last_login_at,
            profile_id: (inserted as any)?.id ?? null,
            old_nickname: null,
            new_nickname: (inserted as any)?.nickname ?? desired,
            action: 'inserted_profile',
          });
          return;
        }

        if (p.nickname && p.nickname.trim() !== '') {
          reportRows.push({
            user_id: u.id,
            phone: u.phone,
            email: u.email,
            user_created_at: u.created_at,
            last_login_at: u.last_login_at,
            profile_id: p.id,
            old_nickname: p.nickname,
            new_nickname: p.nickname,
            action: 'no_change',
          });
          return;
        }

        const { data: updated, error: updErr } = await serviceRoleSupabase
          .from('user_profiles')
          .update({
            nickname: desired,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('user_id', u.id)
          .select('id, nickname')
          .single();

        if (updErr) throw updErr;

        reportRows.push({
          user_id: u.id,
          phone: u.phone,
          email: u.email,
          user_created_at: u.created_at,
          last_login_at: u.last_login_at,
          profile_id: (updated as any)?.id ?? p.id,
          old_nickname: p.nickname ?? null,
          new_nickname: (updated as any)?.nickname ?? desired,
          action: 'updated_nickname',
        });
      } catch (e: any) {
        reportRows.push({
          user_id: u.id,
          phone: u.phone,
          email: u.email,
          user_created_at: u.created_at,
          last_login_at: u.last_login_at,
          profile_id: p?.id ?? null,
          old_nickname: p?.nickname ?? null,
          new_nickname: null,
          action: 'error',
          error: e?.message || String(e),
        });
      }
    }),
  );

  await Promise.all(tasks);

  const summary = {
    generated_at: new Date().toISOString(),
    totals: {
      users_scanned: users.length,
      bad_users_total: badUsers.length,
      bad_users_with_phone: badWithPhone.length,
      bad_users_no_phone: badNoPhone.length,
      inserted_profiles: reportRows.filter((r) => r.action === 'inserted_profile').length,
      updated_nicknames: reportRows.filter((r) => r.action === 'updated_nickname').length,
      errors: reportRows.filter((r) => r.action === 'error').length,
    },
    rows: reportRows.sort((a, b) => (b.user_created_at || '').localeCompare(a.user_created_at || '')),
  };

  const outDir = path.join(process.cwd(), 'temp_dir');
  ensureDir(outDir);
  const outPath = path.join(outDir, `problem_users_nickname_fix_${nowStamp()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, outPath, totals: summary.totals }, null, 2));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[fix-problem-users-nickname] Failed:', e);
  process.exitCode = 1;
});

