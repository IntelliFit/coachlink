import { describe, expect, it } from 'vitest';
import {
    ANNOUNCEMENT_MAX_POPUPS,
    buildAnnouncementFeed,
    matchesAudience,
    normalizeAnnouncementIds,
    validateAnnouncementInput,
    type AnnouncementRow,
} from './announcements';

const NOW = new Date('2026-10-25T12:00:00.000Z');

function row(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
    return {
        id: '00000000-0000-4000-8000-000000000001',
        title: '新版本上线',
        summary: '摘要',
        content: '',
        cover_image_url: null,
        image_urls: [],
        action_label: '',
        weapp_path: '',
        web_path: '',
        audience: 'all',
        status: 'published',
        popup: true,
        pinned: false,
        published_at: '2026-10-25T10:00:00.000Z',
        expires_at: null,
        created_at: '2026-10-25T09:00:00.000Z',
        updated_at: '2026-10-25T09:00:00.000Z',
        ...overrides,
    };
}

function id(n: number) {
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

describe('validateAnnouncementInput', () => {
    it('accepts a minimal announcement and applies defaults', () => {
        const result = validateAnnouncementInput({ title: '  标题 ', summary: '摘要' });
        expect(result).toEqual({
            ok: true,
            value: expect.objectContaining({
                title: '标题',
                audience: 'all',
                popup: true,
                pinned: false,
                cover_image_url: null,
                image_urls: [],
                expires_at: null,
            }),
        });
    });

    it('requires a title and some body', () => {
        expect(validateAnnouncementInput({ summary: 'x' }).ok).toBe(false);
        expect(validateAnnouncementInput({ title: '只有标题' }).ok).toBe(false);
        expect(validateAnnouncementInput({ title: '图片公告', cover_image_url: 'https://cdn.example.com/a.png' }).ok)
            .toBe(true);
    });

    it('rejects non-https images and external jump paths', () => {
        expect(validateAnnouncementInput({ title: 't', cover_image_url: 'http://a.com/x.png' }).ok).toBe(false);
        expect(validateAnnouncementInput({ title: 't', summary: 's', image_urls: ['javascript:alert(1)'] }).ok)
            .toBe(false);
        expect(validateAnnouncementInput({ title: 't', summary: 's', web_path: 'https://evil.com' }).ok).toBe(false);
        expect(validateAnnouncementInput({ title: 't', summary: 's', web_path: '//evil.com' }).ok).toBe(false);
        expect(validateAnnouncementInput({ title: 't', summary: 's', weapp_path: '/toolbox/index' }).ok).toBe(true);
    });

    it('requires a path when a button label is given', () => {
        expect(validateAnnouncementInput({ title: 't', summary: 's', action_label: '去看看' }).ok).toBe(false);
    });

    it('rejects unknown audience and bad expiry', () => {
        expect(validateAnnouncementInput({ title: 't', summary: 's', audience: 'vip' }).ok).toBe(false);
        expect(validateAnnouncementInput({ title: 't', summary: 's', expires_at: 'not-a-date' }).ok).toBe(false);
    });
});

describe('matchesAudience', () => {
    it('routes coach/student announcements by role', () => {
        expect(matchesAudience('all', false)).toBe(true);
        expect(matchesAudience('coach', true)).toBe(true);
        expect(matchesAudience('coach', false)).toBe(false);
        expect(matchesAudience('student', true)).toBe(false);
        expect(matchesAudience('student', false)).toBe(true);
    });
});

describe('buildAnnouncementFeed', () => {
    it('hides drafts, future, expired and other-audience announcements', () => {
        const feed = buildAnnouncementFeed({
            rows: [
                row({ id: id(1) }),
                row({ id: id(2), status: 'draft' }),
                row({ id: id(3), published_at: '2026-10-26T00:00:00.000Z' }),
                row({ id: id(4), expires_at: '2026-10-25T11:00:00.000Z' }),
                row({ id: id(5), audience: 'coach' }),
            ],
            reads: [],
            isCoach: false,
            now: NOW,
        });
        expect(feed.items.map((item) => item.id)).toEqual([id(1)]);
    });

    it('puts pinned first, then newest first', () => {
        const feed = buildAnnouncementFeed({
            rows: [
                row({ id: id(1), published_at: '2026-10-20T00:00:00.000Z' }),
                row({ id: id(2), published_at: '2026-10-24T00:00:00.000Z' }),
                row({ id: id(3), published_at: '2026-10-01T00:00:00.000Z', pinned: true }),
            ],
            reads: [],
            isCoach: false,
            now: NOW,
        });
        expect(feed.items.map((item) => item.id)).toEqual([id(3), id(2), id(1)]);
    });

    it('pops each announcement once and counts unread until opened', () => {
        const feed = buildAnnouncementFeed({
            rows: [row({ id: id(1) }), row({ id: id(2) }), row({ id: id(3) }), row({ id: id(4), popup: false })],
            reads: [
                { announcement_id: id(1), popped_at: '2026-10-25T11:00:00.000Z', read_at: null },
                { announcement_id: id(2), popped_at: null, read_at: '2026-10-25T11:00:00.000Z' },
            ],
            isCoach: false,
            now: NOW,
        });
        expect(feed.popupIds).toEqual([id(3)]);
        expect(feed.unreadCount).toBe(3);
        expect(feed.items.find((item) => item.id === id(2))?.isRead).toBe(true);
    });

    it('caps the number of popups per open', () => {
        const rows = Array.from({ length: ANNOUNCEMENT_MAX_POPUPS + 3 }, (_, i) => row({ id: id(i + 1) }));
        const feed = buildAnnouncementFeed({ rows, reads: [], isCoach: false, now: NOW });
        expect(feed.popupIds).toHaveLength(ANNOUNCEMENT_MAX_POPUPS);
        expect(feed.unreadCount).toBe(rows.length);
    });

    it('drops invalid stored image urls', () => {
        const feed = buildAnnouncementFeed({
            rows: [row({ image_urls: ['https://cdn.example.com/a.png', 'http://x', 3] })],
            reads: [],
            isCoach: false,
            now: NOW,
        });
        expect(feed.items[0].imageUrls).toEqual(['https://cdn.example.com/a.png']);
    });
});

describe('normalizeAnnouncementIds', () => {
    it('keeps unique uuids only', () => {
        expect(normalizeAnnouncementIds([id(1), id(1), 'x', 5, id(2)])).toEqual([id(1), id(2)]);
        expect(normalizeAnnouncementIds('nope')).toEqual([]);
    });
});
