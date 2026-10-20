import { describe, expect, it } from 'vitest';
import { expectedCompPath, fixPageConfigCompPath, weappCompPathPlugin } from '../apps/wechat/config/weappCompPath';

describe('weapp comp path', () => {
  it('uses one ../ per folder level and skips root files', () => {
    expect(expectedCompPath('training/training-execution.json')).toBe('../comp');
    expect(expectedCompPath('coach/plans/dashboard/[id]/training-execution.json')).toBe('../../../../comp');
    expect(expectedCompPath('app.json')).toBeNull();
    expect(expectedCompPath('comp.json')).toBeNull();
  });

  it('fixes a path that is one level too deep', () => {
    const source = '{"usingComponents":{"comp":"../../comp"}}';
    expect(fixPageConfigCompPath('training/training-execution.json', source)).toBe('{"usingComponents":{"comp":"../comp"}}');
  });

  it('leaves correct, root and unrelated files alone', () => {
    expect(fixPageConfigCompPath('training/training-execution.json', '{"usingComponents":{"comp":"../comp"}}')).toBeNull();
    expect(fixPageConfigCompPath('pages/index/index.json', '{"usingComponents":{"comp":"../../comp"}}')).toBeNull();
    expect(fixPageConfigCompPath('app.json', '{"pages":[]}')).toBeNull();
    expect(fixPageConfigCompPath('training/x.js', '"../../comp"')).toBeNull();
  });

  it('rewrites json assets in the bundle without touching chunks', () => {
    const bundle = {
      a: { type: 'asset', fileName: 'coach/settings/security.json', source: '{"usingComponents":{"comp":"../../../comp"}}' },
      b: { type: 'chunk', fileName: 'coach/settings/security.js', code: '"../../../comp"' },
      c: { type: 'asset', fileName: 'me/profile/index.json', source: '{"usingComponents":{"comp":"../../comp"}}' },
    };
    const plugin = weappCompPathPlugin();
    plugin.generateBundle.handler({}, bundle as any);
    expect(bundle.a.source).toBe('{"usingComponents":{"comp":"../../comp"}}');
    expect(bundle.c.source).toBe('{"usingComponents":{"comp":"../../comp"}}');
    expect((bundle.b as any).code).toBe('"../../../comp"');
  });
});
