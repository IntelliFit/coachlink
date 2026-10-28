import { describe, expect, it, vi } from 'vitest';
import { analyzeWithBojiService, getBojiConfig } from './bojiDetector';

const body = { report: { metrics: {} }, messages: {}, abdomen_crop: 'b64' };

describe('analyzeWithBojiService abdomen crop', () => {
  it('asks for the crop only when requested and keeps it on the result', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const config = getBojiConfig({ BOJI_SERVICE_URL: 'http://svc' });
    const withCrop = await analyzeWithBojiService(new Uint8Array([1]), config, fetchImpl as never, 'male', { abdomenCrop: true });
    expect(fetchImpl.mock.calls[0][0]).toBe('http://svc/v1/analyze?abdomen_crop=true');
    expect(withCrop.abdomen_crop).toBe('b64');
    await analyzeWithBojiService(new Uint8Array([1]), config, fetchImpl as never, 'female');
    expect(fetchImpl.mock.calls[1][0]).toBe('http://svc/v1/analyze?sex=female');
    await analyzeWithBojiService(new Uint8Array([1]), config, fetchImpl as never);
    expect(fetchImpl.mock.calls[2][0]).toBe('http://svc/v1/analyze');
  });
});
