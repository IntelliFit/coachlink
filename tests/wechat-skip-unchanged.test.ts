import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { isUnchangedOnDisk, weappSkipUnchangedPlugin } from '../apps/wechat/config/weappSkipUnchanged';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('weapp skip unchanged output', () => {
  it('compares bytes with the file on disk', () => {
    expect(isUnchangedOnDisk(Buffer.from('{"a":1}'), '{"a":1}')).toBe(true);
    expect(isUnchangedOnDisk(Buffer.from('{"a":1}'), '{"a":2}')).toBe(false);
    expect(isUnchangedOnDisk(null, '{"a":1}')).toBe(false);
  });

  it('drops identical files from the bundle and keeps changed and new ones', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skip-unchanged-'));
    tempDirs.push(outDir);
    fs.mkdirSync(path.join(outDir, 'coach'));
    fs.writeFileSync(path.join(outDir, 'coach/revenue.json'), '{"same":true}');
    fs.writeFileSync(path.join(outDir, 'coach/wallet.json'), '{"old":true}');
    fs.writeFileSync(path.join(outDir, 'base.wxml'), '<template name="t"/>');
    fs.writeFileSync(path.join(outDir, 'coach/revenue.js'), 'old()');

    const bundle: Record<string, any> = {
      same: { type: 'asset', fileName: 'coach/revenue.json', source: '{"same":true}' },
      changed: { type: 'asset', fileName: 'coach/wallet.json', source: '{"old":false}' },
      added: { type: 'asset', fileName: 'coach/new.json', source: '{}' },
      template: { type: 'asset', fileName: 'base.wxml', source: '<template name="t"/>' },
      sameChunk: { type: 'chunk', fileName: 'coach/revenue.js', code: 'old()' },
      newChunk: { type: 'chunk', fileName: 'coach/wallet.js', code: 'next()' },
    };
    const plugin = weappSkipUnchangedPlugin();
    plugin.configResolved({ root: outDir, build: { outDir: '.' } });
    plugin.generateBundle.handler({}, bundle);

    expect(Object.keys(bundle).sort()).toEqual(['added', 'changed', 'newChunk']);
  });
});
