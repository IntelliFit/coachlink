import { describe, expect, it, vi } from 'vitest'
import {
    GENERIC_CHAT_PUSH,
    GENERIC_PUSH,
    announcementPushContent,
    chatPushContent,
    loadPushContent,
    previewSystemText,
} from './mobileNotificationContent'

const MESSAGE_ID = '22222222-2222-4222-8222-222222222222'
const SENDER_ID = '33333333-3333-4333-8333-333333333333'

function fakeDb(tables: Record<string, { data: unknown; error?: unknown }>) {
    const from = vi.fn((table: string) => {
        const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            maybeSingle: vi.fn(async () => tables[table] || { data: null, error: null }),
        }
        return builder
    })
    return { from }
}

describe('mobile push content', () => {
    it('flattens system markdown into one readable line', () => {
        expect(previewSystemText('**张三** 请求添加你为好友！[查看](/friends)')).toBe('张三 请求添加你为好友！查看')
        expect(previewSystemText('第一行\n\n第二行 ![图](https://x/y.png)')).toBe('第一行 第二行')
        expect(Array.from(previewSystemText('练'.repeat(200))).length).toBe(90)
        expect(previewSystemText(undefined)).toBe('')
    })

    it('shows system text but keeps private chat content off the lock screen', () => {
        expect(chatPushContent({ isSystem: true, content: '学员 **李四** 已付款' })).toEqual({ title: '系统通知', body: '学员 李四 已付款' })
        expect(chatPushContent({ isSystem: false, senderName: '王教练', messageType: 'text', content: '私密内容' })).toEqual({ title: '王教练', body: '发来一条新消息' })
        expect(chatPushContent({ isSystem: false, senderName: '王教练', messageType: 'image' })).toEqual({ title: '王教练', body: '发来一张图片' })
        expect(chatPushContent({ isSystem: false, senderName: '', messageType: 'text' })).toEqual(GENERIC_CHAT_PUSH)
    })

    it('uses the announcement title looked up at send time', async () => {
        expect(announcementPushContent('  新版本\n上线 ')).toEqual({ title: '平台通知', body: '新版本 上线' })
        expect(announcementPushContent(null)).toEqual({ title: '平台通知', body: '你有一条新的平台通知' })
        const db = fakeDb({ announcements: { data: { title: '双十一活动' } } })
        await expect(loadPushContent(db, { kind: 'announcement', payload: { announcementId: MESSAGE_ID } }))
            .resolves.toEqual({ title: '平台通知', body: '双十一活动' })
        await expect(loadPushContent(fakeDb({}), { kind: 'announcement', payload: { announcementId: 'bad' } }))
            .resolves.toEqual({ title: '平台通知', body: '你有一条新的平台通知' })
    })

    it('loads sender and system role for chat rows', async () => {
        const db = fakeDb({
            chat_messages: { data: { sender_id: SENDER_ID, message_type: 'text', content: '**赵六** 请求添加你为好友！', content_metadata: { system_notice: true } } },
            admin_users: { data: { user_id: SENDER_ID } },
            user_profiles: { data: { nickname: '系统' } },
        })
        await expect(loadPushContent(db, { kind: 'chat_message', payload: { messageId: MESSAGE_ID } }))
            .resolves.toEqual({ title: '系统通知', body: '赵六 请求添加你为好友！' })

        // 管理员账号本人发的私聊没有 system_notice 标记，不能把正文放上锁屏。
        const adminPersonal = fakeDb({
            chat_messages: { data: { sender_id: SENDER_ID, message_type: 'text', content: '私下聊聊你的伤病', content_metadata: null } },
            admin_users: { data: { user_id: SENDER_ID } },
            user_profiles: { data: { nickname: '管理员小王' } },
        })
        await expect(loadPushContent(adminPersonal, { kind: 'chat_message', payload: { messageId: MESSAGE_ID } }))
            .resolves.toEqual({ title: '管理员小王', body: '发来一条新消息' })

        // 发送方指定的锁屏文案优先于正文（正文里可能有健康信息）。
        const withPreview = fakeDb({
            chat_messages: { data: { sender_id: SENDER_ID, message_type: 'text', content: 'AI 草稿：右膝疼痛', content_metadata: { system_notice: true, push_preview: '学员反馈已生成 AI 调整草稿' } } },
            admin_users: { data: { user_id: SENDER_ID } },
            user_profiles: { data: null },
        })
        await expect(loadPushContent(withPreview, { kind: 'chat_message', payload: { messageId: MESSAGE_ID } }))
            .resolves.toEqual({ title: '系统通知', body: '学员反馈已生成 AI 调整草稿' })

        const personal = fakeDb({
            chat_messages: { data: { sender_id: SENDER_ID, message_type: 'video', content: 'secret' } },
            admin_users: { data: null },
            user_profiles: { data: { nickname: '小明' } },
        })
        await expect(loadPushContent(personal, { kind: 'chat_message', payload: { messageId: MESSAGE_ID } }))
            .resolves.toEqual({ title: '小明', body: '发来一个视频' })
    })

    it('falls back to generic copy when lookups fail or ids are invalid', async () => {
        const broken = { from: vi.fn(() => { throw new Error('db down') }) }
        await expect(loadPushContent(broken, { kind: 'chat_message', payload: { messageId: MESSAGE_ID } })).resolves.toEqual(GENERIC_CHAT_PUSH)
        await expect(loadPushContent(fakeDb({}), { kind: 'chat_message', payload: { messageId: 'nope' } })).resolves.toEqual(GENERIC_CHAT_PUSH)
        await expect(loadPushContent(fakeDb({}), { kind: 'something_else', payload: null })).resolves.toEqual(GENERIC_PUSH)
    })
})
