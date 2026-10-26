import { describe, expect, it } from 'vitest';
import { BOJI_CHUNK_NAME, isBojiChunkModule, weappBojiChunkPlugin } from '../apps/wechat/config/weappBojiChunk';

const W = 'D:/projects_mjw/coachlink/apps/wechat/src';

describe('weappBojiChunk', () => {
  it('routes boji scripts, core helpers and the cover into the subpackage chunk', () => {
    expect(isBojiChunkModule(`${W}/toolbox/boji/ResultHero.tsx`)).toBe(true);
    expect(isBojiChunkModule(`${W}/toolbox/boji/bojiPoster.ts`)).toBe(true);
    expect(isBojiChunkModule('D:\\projects_mjw\\coachlink\\packages\\core\\src\\bojiInsights.ts')).toBe(true);
    expect(isBojiChunkModule(`${W}/services/bojiDetectorService.ts`)).toBe(true);
    expect(isBojiChunkModule(`${W}/assets/images/toolbox-practical/practical-boji-detector-v2.webp?url`)).toBe(true);
  });

  it('leaves the page entry, stylesheets and unrelated modules alone', () => {
    expect(isBojiChunkModule(`${W}/toolbox/boji/index.tsx`)).toBe(false);
    expect(isBojiChunkModule(`${W}/toolbox/boji/index.scss`)).toBe(false);
    expect(isBojiChunkModule(`${W}/toolbox/power-analysis/PowerCurveChart.tsx`)).toBe(false);
    expect(isBojiChunkModule('D:/projects_mjw/coachlink/packages/core/src/planProgress.ts')).toBe(false);
  });

  it('wraps Taro manualChunks and falls back to it for other modules', () => {
    const plugin = weappBojiChunkPlugin();
    const wrapped = plugin.outputOptions({ manualChunks: () => 'common' });
    expect(wrapped?.manualChunks).toBeTypeOf('function');
    const chunks = wrapped!.manualChunks as (id: string, api: unknown) => string;
    expect(chunks(`${W}/toolbox/boji/ResultHero.tsx`, {})).toBe(BOJI_CHUNK_NAME);
    expect(chunks(`${W}/utils/share.ts`, {})).toBe('common');
    expect(plugin.outputOptions({})).toBeNull();
  });
});
