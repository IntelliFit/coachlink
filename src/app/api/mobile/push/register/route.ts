import { NextResponse } from 'next/server'
import { getApiUserId } from '@/lib/getApiUserId'
import { serviceRoleSupabase as supabase } from '@/lib/supabaseClient'

const EXPO_PUSH_TOKEN_PATTERN = /^(?:ExpoPushToken|ExponentPushToken)\[[^\]]{8,512}\]$/
const INSTALLATION_ID_PATTERN = /^[A-Za-z0-9._:-]{12,200}$/
const PLATFORMS = new Set(['android', 'ios'])

type RegisterBody = {
    installationId?: string
    pushToken?: string
    platform?: string
    permissionStatus?: string
    appVersion?: string
    locale?: string
    timezone?: string
    deviceModel?: string
}

function cleanOptionalText(value: unknown, maxLength: number) {
    if (typeof value !== 'string') return null
    return value.trim().slice(0, maxLength) || null
}

export async function POST(request: Request) {
    const userId = await getApiUserId(request)
    if (!userId) {
        return NextResponse.json({ success: false, message: '用户未登录', data: null }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as RegisterBody | null
    const installationId = body?.installationId?.trim() || ''
    const pushToken = body?.pushToken?.trim() || ''
    const platform = body?.platform?.trim().toLowerCase() || ''
    if (!INSTALLATION_ID_PATTERN.test(installationId) || !EXPO_PUSH_TOKEN_PATTERN.test(pushToken) || !PLATFORMS.has(platform)) {
        return NextResponse.json({ success: false, message: '推送设备参数无效', data: null }, { status: 400 })
    }

    // The database function atomically reconciles both unique identities
    // (installation and Expo token). A normal UPSERT can only target one and
    // fails when Expo reuses a token after the app is reinstalled.
    const { error } = await (supabase as any).rpc('register_mobile_push_installation', {
        p_user_id: userId,
        p_installation_id: installationId,
        p_push_token: pushToken,
        p_platform: platform,
        p_permission_status: cleanOptionalText(body?.permissionStatus, 32) || 'granted',
        p_app_version: cleanOptionalText(body?.appVersion, 64),
        p_locale: cleanOptionalText(body?.locale, 32),
        p_timezone: cleanOptionalText(body?.timezone, 64),
        p_device_model: cleanOptionalText(body?.deviceModel, 120),
    })

    if (error) {
        console.error('注册移动推送设备失败:', { code: error.code, message: error.message })
        return NextResponse.json({ success: false, message: '推送设备注册失败', data: null }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '推送设备已注册', data: { registered: true } })
}

export async function DELETE(request: Request) {
    const userId = await getApiUserId(request)
    if (!userId) {
        return NextResponse.json({ success: false, message: '用户未登录', data: null }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as Pick<RegisterBody, 'installationId'> | null
    const installationId = body?.installationId?.trim() || ''
    if (!INSTALLATION_ID_PATTERN.test(installationId)) {
        return NextResponse.json({ success: false, message: '推送设备参数无效', data: null }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error } = await (supabase as any)
        .from('mobile_push_installations')
        .update({ enabled: false, invalidated_at: now, updated_at: now })
        .eq('user_id', userId)
        .eq('provider', 'expo')
        .eq('installation_id', installationId)

    if (error) {
        console.error('注销移动推送设备失败:', { code: error.code, message: error.message })
        return NextResponse.json({ success: false, message: '推送设备注销失败', data: null }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '推送设备已注销', data: { registered: false } })
}
