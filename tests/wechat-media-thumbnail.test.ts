import { describe, expect, it, vi } from 'vitest';

vi.mock('../apps/wechat/src/utils/request', () => ({ API_BASE_URL: 'https://api.example.test' }));

import { resolveWeappImageThumbnailUrl } from '../apps/wechat/src/utils/mediaUrl';

const CDN_PNG = 'https://cdn-assets.coachlink.fit/action-reference-images/reviewed-library-2026-10-07/pullup-a3773e5d6921.png';

describe('resolveWeappImageThumbnailUrl', () => {
  it('requests a downscaled JPEG from the COS image service', () => {
    expect(resolveWeappImageThumbnailUrl(CDN_PNG)).toBe(`${CDN_PNG}?imageMogr2/thumbnail/480x/format/jpg/quality/80`);
    expect(resolveWeappImageThumbnailUrl(CDN_PNG, 960)).toBe(`${CDN_PNG}?imageMogr2/thumbnail/960x/format/jpg/quality/80`);
  });

  it('clamps the requested width', () => {
    expect(resolveWeappImageThumbnailUrl(CDN_PNG, 10)).toContain('/thumbnail/64x/');
    expect(resolveWeappImageThumbnailUrl(CDN_PNG, 9000)).toContain('/thumbnail/1600x/');
  });

  it('leaves URLs it cannot safely resize unchanged', () => {
    expect(resolveWeappImageThumbnailUrl('https://other.example.com/a.png')).toBe('https://other.example.com/a.png');
    expect(resolveWeappImageThumbnailUrl(`${CDN_PNG}?v=2`)).toBe(`${CDN_PNG}?v=2`);
    expect(resolveWeappImageThumbnailUrl('https://cdn-assets.coachlink.fit/demo/clip.mp4')).toBe('https://cdn-assets.coachlink.fit/demo/clip.mp4');
    expect(resolveWeappImageThumbnailUrl('/uploads/a.png')).toBe('https://api.example.test/uploads/a.png');
    expect(resolveWeappImageThumbnailUrl(null)).toBe('');
  });
});
