import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendSystemMessage: vi.fn() }))

vi.mock('./chat', () => ({ sendSystemMessage: mocks.sendSystemMessage }))
vi.mock('./supabaseClient', () => ({ serviceRoleSupabase: {} }))

import {
    buildPlatformNoticeContent,
    notifyPlatformOwners,
    resolvePlatformNoticeRecipients,
    toNoticeField,
} from './platformNotice'

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const notice = {
    kind: 'coach_application_new' as const,
    title: '新的教练申请',
    fields: [
        ['申请人', '张三'],
        ['城市', null],
        ['从业年限', 3],
    ] as const,
    adminPath: '/admin/coach-applications',
}

describe('resolvePlatformNoticeRecipients', () => {
    it('falls back to the founder accounts when nothing is configured', () => {
        const ids = resolvePlatformNoticeRecipients('')
        expect(ids).toHaveLength(2)
        expect(ids).toContain('f9eac5b1-45f9-4479-9ab8-8223a5db8835')
    })

    it('uses configured ids, dropping invalid and duplicate entries', () => {
        expect(resolvePlatformNoticeRecipients(` ${A}, not-a-uuid, ${B}, ${A} `)).toEqual([A, B])
    })

    it('falls back when every configured id is invalid', () => {
        expect(resolvePlatformNoticeRecipients('oops')).toHaveLength(2)
    })
})

describe('buildPlatformNoticeContent', () => {
    it('renders title, non-empty fields and the admin link', () => {
        const content = buildPlatformNoticeContent(notice, 'https://example.test/')
        expect(content.split('  \n')).toEqual([
            '【平台待办】新的教练申请',
            '申请人：张三',
            '从业年限：3',
            '处理入口：https://example.test/admin/coach-applications',
        ])
    })

    it('flattens and truncates user supplied values', () => {
        expect(toNoticeField('  第一行\n第二行  ')).toBe('第一行 第二行')
        expect(toNoticeField('x'.repeat(100))).toBe(`${'x'.repeat(80)}…`)
        expect(toNoticeField(undefined)).toBe('')
    })
})

describe('notifyPlatformOwners', () => {
    beforeEach(() => {
        mocks.sendSystemMessage.mockReset()
        vi.stubEnv('PLATFORM_NOTICE_RECIPIENT_USER_IDS', `${A},${B}`)
    })

    it('sends the notice to every recipient with metadata', async () => {
        mocks.sendSystemMessage.mockResolvedValue(true)
        await expect(notifyPlatformOwners(notice)).resolves.toBe(2)
        expect(mocks.sendSystemMessage).toHaveBeenCalledTimes(2)
        expect(mocks.sendSystemMessage).toHaveBeenCalledWith(A, {
            content: expect.stringContaining('【平台待办】新的教练申请'),
            content_metadata: {
                platform_notice: { kind: 'coach_application_new', admin_path: '/admin/coach-applications' },
            },
        })
    })

    it('never throws when sending fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        mocks.sendSystemMessage.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('db down'))
        await expect(notifyPlatformOwners(notice)).resolves.toBe(1)
    })
})
