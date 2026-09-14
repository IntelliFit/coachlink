import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NormalizedPrivateChatMembers = {
    ok: true;
    members: [string, string];
    requestedMembers: [string, string];
    normalizedLegacyCoachIds: boolean;
};

export type InvalidPrivateChatMembers = {
    ok: false;
    status: 400 | 403 | 500;
    message: string;
};

export type NormalizePrivateChatMembersResult =
    | NormalizedPrivateChatMembers
    | InvalidPrivateChatMembers;

/**
 * Chat-room members are always users.id values.
 *
 * Older mini-program builds sent coach_subscriptions.coach_id (coaches.id)
 * here. Keep a narrow compatibility conversion so those builds immediately
 * stop creating orphan rooms, while rejecting every other unknown UUID.
 */
export async function normalizePrivateChatMembers(
    client: SupabaseClient<Database>,
    rawMembers: unknown,
    currentUserId?: string,
): Promise<NormalizePrivateChatMembersResult> {
    if (!Array.isArray(rawMembers) || rawMembers.length !== 2) {
        return { ok: false, status: 400, message: '私聊必须且只能包含两名成员' };
    }

    const requested = rawMembers.map((member) => String(member || '').trim());
    if (requested.some((member) => !UUID_PATTERN.test(member))) {
        return { ok: false, status: 400, message: '聊天成员参数非法' };
    }
    if (new Set(requested).size !== 2) {
        return { ok: false, status: 400, message: '不能与自己创建私聊' };
    }

    const { data: directUsers, error: directUsersError } = await client
        .from('users')
        .select('id')
        .in('id', requested);

    if (directUsersError) {
        console.error('[chat-members] validate users failed:', directUsersError);
        return { ok: false, status: 500, message: '校验聊天成员失败' };
    }

    const directUserIds = new Set((directUsers || []).map((user) => user.id));
    const missingIds = requested.filter((member) => !directUserIds.has(member));
    const coachUserByCoachId = new Map<string, string>();

    if (missingIds.length > 0) {
        const { data: coaches, error: coachesError } = await client
            .from('coaches')
            .select('id, user_id')
            .in('id', missingIds);

        if (coachesError) {
            console.error('[chat-members] resolve legacy coach ids failed:', coachesError);
            return { ok: false, status: 500, message: '校验教练账号失败' };
        }

        for (const coach of coaches || []) {
            if (coach.user_id) coachUserByCoachId.set(coach.id, coach.user_id);
        }
    }

    const normalized = requested.map((member) =>
        directUserIds.has(member) ? member : (coachUserByCoachId.get(member) || ''),
    );

    if (normalized.some((member) => !member) || new Set(normalized).size !== 2) {
        return { ok: false, status: 400, message: '聊天对象不存在或账号信息不完整' };
    }

    const normalizedUserIds = [...new Set(normalized)];
    const { data: normalizedUsers, error: normalizedUsersError } = await client
        .from('users')
        .select('id')
        .in('id', normalizedUserIds);

    if (normalizedUsersError) {
        console.error('[chat-members] validate normalized users failed:', normalizedUsersError);
        return { ok: false, status: 500, message: '校验聊天成员失败' };
    }
    if ((normalizedUsers || []).length !== 2) {
        return { ok: false, status: 400, message: '聊天对象不存在或账号信息不完整' };
    }

    if (currentUserId && !normalized.includes(currentUserId)) {
        return { ok: false, status: 403, message: '没有权限' };
    }

    return {
        ok: true,
        members: normalized as [string, string],
        requestedMembers: requested as [string, string],
        normalizedLegacyCoachIds: normalized.some((member, index) => member !== requested[index]),
    };
}
