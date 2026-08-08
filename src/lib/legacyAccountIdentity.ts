import { serviceRoleSupabase } from '@/lib/supabaseClient';

/**
 * Compatibility path for historical rows that stored a verified-looking phone
 * only in user_profiles. Call this only after the caller has verified the SMS
 * code. New authentication code must continue treating users.phone as the
 * canonical login identity.
 */
export async function claimLegacyUserByVerifiedPhone(phone: string) {
  const { data: profiles, error: profileError } = await serviceRoleSupabase
    .from('user_profiles')
    .select('user_id')
    .eq('phone', phone)
    .limit(2);

  if (profileError) {
    throw new Error('检查历史账号失败，请稍后重试');
  }

  if (!profiles?.length) return null;
  if (profiles.length > 1) {
    throw new Error('该手机号关联了多个历史账号，请联系管理员处理');
  }

  const userId = profiles[0]?.user_id;
  if (!userId) return null;

  const { data: legacyUser, error: userError } = await serviceRoleSupabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    throw new Error('读取历史账号失败，请稍后重试');
  }
  if (!legacyUser) return null;
  if (legacyUser.phone === phone) return legacyUser;
  if (legacyUser.phone && legacyUser.phone !== 'null') return null;

  const { data: claimedUser, error: claimError } = await serviceRoleSupabase
    .from('users')
    .update({ phone, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .is('phone', null)
    .select('*')
    .maybeSingle();

  if (claimError?.code === '23505') {
    throw new Error('该手机号已属于另一个账号，需要先确认账号合并');
  }
  if (claimError) {
    throw new Error('恢复历史账号失败，请稍后重试');
  }

  return claimedUser;
}
