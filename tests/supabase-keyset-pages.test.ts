import { describe, expect, it } from 'vitest';
import { chunkIds, readAllRowsByIdChunks, readAllRowsByKeyset } from '@/lib/supabaseKeysetPages';

const rows = Array.from({ length: 7 }, (_, index) => ({ id: `id-${index}`, value: index }));
const pageAfter = (afterId: string | null, pageSize: number) =>
  Promise.resolve({ data: rows.filter((row) => afterId === null || row.id > afterId).slice(0, pageSize), error: null });

describe('readAllRowsByKeyset', () => {
  it('keeps reading past a full page until a short page arrives', async () => {
    const calls: Array<string | null> = [];
    const result = await readAllRowsByKeyset((afterId) => { calls.push(afterId); return pageAfter(afterId, 3); }, 3);
    expect(result.data?.map((row) => row.value)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(calls).toEqual([null, 'id-2', 'id-5']);
  });

  it('makes one extra request when the last page is exactly full', async () => {
    const calls: Array<string | null> = [];
    const result = await readAllRowsByKeyset((afterId) => { calls.push(afterId); return pageAfter(afterId, 7); }, 7);
    expect(result.data).toHaveLength(7);
    expect(calls).toEqual([null, 'id-6']);
  });

  it('returns the error instead of a partial list', async () => {
    let call = 0;
    const result = await readAllRowsByKeyset(() => Promise.resolve(call++ === 0
      ? { data: rows.slice(0, 2), error: null }
      : { data: null, error: { message: 'timeout' } }), 2);
    expect(result).toEqual({ data: null, error: { message: 'timeout' } });
  });

  it('refuses to loop when full pages do not carry ids', async () => {
    const result = await readAllRowsByKeyset(() => Promise.resolve({ data: [{}, {}], error: null }), 2);
    expect(result.data).toBeNull();
    expect(String((result.error as Error).message)).toContain('id');
  });
});

describe('chunkIds', () => {
  it('drops blanks and duplicates and splits into fixed-size chunks', () => {
    expect(chunkIds(['a', 'b', '', null, 'a', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
    expect(chunkIds([], 2)).toEqual([]);
  });
});

describe('readAllRowsByIdChunks', () => {
  it('reads every chunk and every page of each chunk', async () => {
    const seen: string[][] = [];
    const result = await readAllRowsByIdChunks(['x', 'y', 'z'], (chunk, afterId) => {
      if (afterId === null) seen.push(chunk);
      return pageAfter(afterId, 3);
    }, { chunkSize: 2, pageSize: 3 });
    expect(seen).toEqual([['x', 'y'], ['z']]);
    expect(result.data).toHaveLength(14);
  });

  it('stops at the first failing chunk', async () => {
    const result = await readAllRowsByIdChunks(['x', 'y'], (chunk) => Promise.resolve(chunk[0] === 'y'
      ? { data: null, error: { message: 'boom' } }
      : { data: [], error: null }), { chunkSize: 1 });
    expect(result).toEqual({ data: null, error: { message: 'boom' } });
  });

  it('does not query at all for an empty id list', async () => {
    let calls = 0;
    const result = await readAllRowsByIdChunks([], () => { calls += 1; return Promise.resolve({ data: [], error: null }); });
    expect(result).toEqual({ data: [], error: null });
    expect(calls).toBe(0);
  });
});
