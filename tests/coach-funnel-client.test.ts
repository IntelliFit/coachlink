import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COACH_EXIT_COOLDOWN_MS } from '@coachlink/core/src/coachFunnel';
import {
    clearCoachExitCandidate,
    readCoachExitCandidate,
    rememberCoachExitCandidate,
    takeCoachExitQuestion,
    trackCoachFunnel,
    trackCoachListView,
} from '@/lib/coachFunnelClient';

const NOW = 1_800_000_000_000;
const candidate = { coachId: 'coach-1', coachName: '教练', leftAt: NOW, trigger: 'list_return' as const };

function stubBrowser(hostname = 'coachlink.fit') {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
        location: { hostname },
        localStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
        },
    });
    const fetchMock = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const sentBody = (fetchMock: ReturnType<typeof stubBrowser>, index = 0) =>
    JSON.parse(String((fetchMock.mock.calls[index] as unknown as [string, RequestInit])[1].body));

describe('coachFunnelClient', () => {
    let fetchMock: ReturnType<typeof stubBrowser>;

    beforeEach(() => {
        fetchMock = stubBrowser();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends the event with a stable anonymous id and marks production traffic', () => {
        trackCoachFunnel('profile_view', { coachId: 'coach-1' });
        trackCoachFunnel('pricing_view', { coachId: 'coach-1' });
        const first = sentBody(fetchMock, 0);
        expect(first).toMatchObject({ event: 'profile_view', platform: 'web', coachId: 'coach-1' });
        expect(first.properties.env).toBe('release');
        expect(first.anonId).toBeTruthy();
        expect(sentBody(fetchMock, 1).anonId).toBe(first.anonId);
    });

    it('marks other hosts so test traffic stays out of the report', () => {
        fetchMock = stubBrowser('dev.coachlink.fit');
        trackCoachFunnel('list_view');
        expect(sentBody(fetchMock).properties.env).toBe('dev');
    });

    it('never surfaces a failed request', async () => {
        fetchMock.mockRejectedValueOnce(new Error('offline'));
        expect(() => trackCoachFunnel('list_view')).not.toThrow();
        await Promise.resolve();
    });

    it('counts a list view once per ten minutes', () => {
        trackCoachListView(NOW);
        trackCoachListView(NOW + 60_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        trackCoachListView(NOW + 11 * 60_000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('asks once for a remembered exit, then waits out the cooldown', () => {
        rememberCoachExitCandidate(candidate);
        expect(takeCoachExitQuestion(NOW + 1000)).toEqual(candidate);
        expect(readCoachExitCandidate()).toBeNull();
        expect(takeCoachExitQuestion(NOW + 2000)).toBeNull();

        rememberCoachExitCandidate({ ...candidate, leftAt: NOW + 3000 });
        expect(takeCoachExitQuestion(NOW + 4000)).toBeNull();

        const later = NOW + 1000 + COACH_EXIT_COOLDOWN_MS;
        rememberCoachExitCandidate({ ...candidate, leftAt: later });
        expect(takeCoachExitQuestion(later + 1000)).not.toBeNull();
    });

    it('does nothing when the candidate was cleared or storage holds junk', () => {
        rememberCoachExitCandidate(candidate);
        clearCoachExitCandidate();
        expect(takeCoachExitQuestion(NOW)).toBeNull();
        (window.localStorage as Storage).setItem('coach_exit_candidate_v1', 'not json');
        expect(readCoachExitCandidate()).toBeNull();
    });
});
