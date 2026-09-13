import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processMobileNotificationOutbox, redactMobilePushError } from '@/lib/processMobileNotificationOutbox'

export const runtime = 'nodejs'

function authorized(request: Request) {
    const expected = process.env.MOBILE_PUSH_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
    if (!expected) return false
    const bearerMatch = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)
    const provided = request.headers.get('x-cron-secret')?.trim()
        || bearerMatch?.[1]?.trim()
        || ''
    const providedBytes = Buffer.from(provided)
    const expectedBytes = Buffer.from(expected)
    return providedBytes.length === expectedBytes.length
        && timingSafeEqual(providedBytes, expectedBytes)
}

function requestedLimit(request: Request) {
    const raw = new URL(request.url).searchParams.get('limit')
    if (!raw) return 50
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return 50
    return Math.min(Math.max(Math.trunc(parsed), 1), 100)
}

async function handle(request: Request) {
    if (!process.env.MOBILE_PUSH_CRON_SECRET?.trim() && !process.env.CRON_SECRET?.trim()) {
        return NextResponse.json({ success: false, message: '移动推送任务未配置' }, { status: 503 })
    }
    if (!authorized(request)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    try {
        const result = await processMobileNotificationOutbox(requestedLimit(request))
        return NextResponse.json({ success: true, data: result })
    } catch (error) {
        console.error('处理移动通知队列失败:', redactMobilePushError(error))
        return NextResponse.json({ success: false, message: '移动通知处理失败' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    return handle(request)
}

export async function GET(request: Request) {
    return handle(request)
}
