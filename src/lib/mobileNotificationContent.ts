/**
 * 移动推送锁屏文案。
 *
 * - 系统消息（好友申请、付款、审核结果、自动化提醒等，均由 sendSystemMessage 发出，
 *   带 content_metadata.system_notice 标记）是平台生成的通知，直接展示去掉 Markdown 的摘要；
 *   发送方可用 content_metadata.push_preview 指定锁屏文案（避免健康信息上锁屏）。
 *   只认标记、不认发送者：管理员账号本人发的私聊仍按私聊处理。
 * - 用户之间的私聊只展示发送者昵称和消息类型，不把聊天正文放到锁屏上。
 * - 查不到消息或发送者时退回通用文案，文案查询失败绝不阻塞推送。
 */

export type PushContent = { title: string; body: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_TITLE_LENGTH = 40
const MAX_BODY_LENGTH = 90

export const GENERIC_CHAT_PUSH: PushContent = { title: 'CoachLink', body: '你有一条新消息' }
export const GENERIC_PUSH: PushContent = { title: 'CoachLink', body: '你有一条新通知' }

function clip(value: string, max: number) {
    const chars = Array.from(value)
    return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : value
}

/** 系统消息正文是 Markdown（`**昵称** 请求添加你为好友！[查看](/friends)`），转成一行纯文本。 */
export function previewSystemText(raw: unknown): string {
    const text = typeof raw === 'string' ? raw : ''
    const flattened = text
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`~#>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    return clip(flattened, MAX_BODY_LENGTH)
}

const MESSAGE_TYPE_BODY: Record<string, string> = {
    image: '发来一张图片',
    video: '发来一个视频',
    video_reference: '分享了一条训练视频',
    voice: '发来一条语音',
    audio: '发来一条语音',
    file: '发来一个文件',
}

export function chatPushContent(input: {
    isSystem: boolean
    senderName?: string | null
    messageType?: string | null
    content?: string | null
}): PushContent {
    if (input.isSystem) {
        const body = previewSystemText(input.content)
        return { title: '系统通知', body: body || GENERIC_CHAT_PUSH.body }
    }
    const name = clip(String(input.senderName || '').trim(), MAX_TITLE_LENGTH)
    const body = MESSAGE_TYPE_BODY[String(input.messageType || '')] || '发来一条新消息'
    return name ? { title: name, body } : GENERIC_CHAT_PUSH
}

export function announcementPushContent(announcementTitle: unknown): PushContent {
    const title = typeof announcementTitle === 'string' ? announcementTitle.replace(/\s+/g, ' ').trim() : ''
    return { title: '平台通知', body: title ? clip(title, MAX_BODY_LENGTH) : '你有一条新的平台通知' }
}

type ContentRow = {
    kind: string
    payload: Record<string, unknown> | null
}

async function loadChatPushContent(db: any, payload: Record<string, unknown> | null): Promise<PushContent> {
    const messageId = typeof payload?.messageId === 'string' && UUID_PATTERN.test(payload.messageId) ? payload.messageId : ''
    if (!messageId) return GENERIC_CHAT_PUSH
    const { data: message, error } = await db
        .from('chat_messages')
        .select('sender_id, message_type, content, content_metadata')
        .eq('id', messageId)
        .maybeSingle()
    const senderId = typeof message?.sender_id === 'string' ? message.sender_id : ''
    if (error || !senderId) return GENERIC_CHAT_PUSH

    const [adminResult, profileResult] = await Promise.all([
        db.from('admin_users').select('user_id').eq('user_id', senderId).maybeSingle(),
        db.from('user_profiles').select('nickname').eq('user_id', senderId).maybeSingle(),
    ])
    const metadata = message.content_metadata && typeof message.content_metadata === 'object' ? message.content_metadata : {}
    const isSystem = metadata.system_notice === true && !adminResult?.error && adminResult?.data?.user_id === senderId
    const pushPreview = typeof metadata.push_preview === 'string' ? metadata.push_preview : ''
    return chatPushContent({
        isSystem,
        senderName: profileResult?.error ? '' : profileResult?.data?.nickname,
        messageType: message.message_type,
        content: isSystem && pushPreview ? pushPreview : message.content,
    })
}

async function loadAnnouncementPushContent(db: any, payload: Record<string, unknown> | null): Promise<PushContent> {
    const announcementId = typeof payload?.announcementId === 'string' && UUID_PATTERN.test(payload.announcementId) ? payload.announcementId : ''
    if (!announcementId) return announcementPushContent('')
    const { data, error } = await db
        .from('announcements')
        .select('title')
        .eq('id', announcementId)
        .maybeSingle()
    return announcementPushContent(error ? '' : data?.title)
}

export async function loadPushContent(db: any, row: ContentRow): Promise<PushContent> {
    try {
        if (row.kind === 'chat_message') return await loadChatPushContent(db, row.payload)
        if (row.kind === 'announcement') return await loadAnnouncementPushContent(db, row.payload)
        return GENERIC_PUSH
    } catch {
        if (row.kind === 'announcement') return announcementPushContent('')
        return row.kind === 'chat_message' ? GENERIC_CHAT_PUSH : GENERIC_PUSH
    }
}
