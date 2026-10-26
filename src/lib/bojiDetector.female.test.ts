import { describe, expect, it, vi } from 'vitest';
import { analyzeWithBojiService, getBojiConfig } from './bojiDetector';

describe('analyzeWithBojiService profile', () => {
  const config = { ...getBojiConfig({}), serviceUrl: 'http://boji:8000' };
  const ok = () => new Response(JSON.stringify({ report: { metrics: {} }, messages: {} }), { status: 200 });

  it('asks for the female profile only when requested', async () => {
    const fetchImpl = vi.fn(async () => ok());
    await analyzeWithBojiService(new Uint8Array([1]), config, fetchImpl as unknown as typeof fetch);
    await analyzeWithBojiService(new Uint8Array([1]), config, fetchImpl as unknown as typeof fetch, 'female');
    expect(fetchImpl.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      'http://boji:8000/v1/analyze',
      'http://boji:8000/v1/analyze?sex=female',
    ]);
  });
});
