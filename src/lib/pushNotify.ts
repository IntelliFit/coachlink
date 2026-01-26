/**
 * Web Push 发送：向指定用户的已注册订阅发送系统通知
 * 需配置 VAPID 密钥：NEXT_PUBLIC_VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY
 */

import webpush from 'web-push';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { Database } from '@/types/database.types';

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    tag?: string;
}

let vapidConfigured = false;

function ensureVapid() {
    if (vapidConfigured) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
        throw new Error('未配置 VAPID：NEXT_PUBLIC_VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY');
    }
    webpush.setVapidDetails(
        process.env.NEXTAUTH_URL || 'https://coachlink.fit',
        publicKey,
        privateKey
    );
    vapidConfigured = true;
}

/**
 * 向指定用户的所有推送订阅发送通知
 */
export async function sendPushToUser(
    userId: string,
    payload: PushPayload
): Promise<{ sent: number; failed: number }> {
    ensureVapid();

    const { data: rows, error } = await serviceRoleSupabase
        .from('push_subscriptions')
        .select('endpoint, keys_p256dh, keys_auth')
        .eq('user_id', userId);

    if (error || !rows?.length) {
        return { sent: 0, failed: 0 };
    }

    const body = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? '/icons/icon-192.png',
        url: payload.url ?? '/messages',
        tag: payload.tag ?? 'default',
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    await Promise.all(
        rows.map(async (sub) => {
            try {
                console.log('[pushNotify] 发送推送到:', sub.endpoint.substring(0, 50) + '...');
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
                    },
                    body,
                    { TTL: 60 * 60 * 24 }
                );
                console.log('[pushNotify] 推送发送成功');
                sent ++;
            } catch (error: any) {
                const errorMsg = error?.message || '未知错误';
                console.error('[pushNotify] 推送发送失败:', errorMsg, error);
                errors.push(errorMsg);
                failed++;
            }
        })
    );

    if (errors.length > 0) {
        console.warn('[pushNotify] 部分推送失败:', errors);
    }

    return { sent, failed };
}
