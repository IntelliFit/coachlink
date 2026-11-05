import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Production PostgREST (v12.2.3) rejects any PATCH that carries an or= filter with
// 42703 "column <table>.<col> does not exist", although the same filter works on
// select and delete. Mocked Supabase tests cannot see this. On 2026-11-05 it left a
// paid coach purchase unactivated and the student paid twice.
const ROOTS = ['src', 'packages', path.join('apps', 'wechat', 'src'), path.join('apps', 'mobile', 'src')];
const SKIP = new Set(['node_modules', '.next', 'dist', '.git']);
/** How far after a builder declaration a later `.or()` on the same variable is looked for. */
const BUILDER_WINDOW_LINES = 30;

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The expression starting at `lines[start]`: that line plus following lines that continue a `.chain`, cut at `;`. */
function chainFrom(lines: string[], start: number, fromColumn = 0): string {
  let chain = lines[start].slice(fromColumn);
  for (let next = start + 1; next < lines.length && /^\s*\./.test(lines[next]); next += 1) chain += `\n${lines[next]}`;
  const semicolon = chain.indexOf(';');
  return semicolon >= 0 ? chain.slice(0, semicolon) : chain;
}

/** 1-based lines of `.update(` chains with `.or(`, and of `.or()` calls on a builder variable created from an update. */
function updateOrChains(text: string): number[] {
  const lines = text.split('\n');
  const found = new Set<number>();
  lines.forEach((line, index) => {
    const column = line.indexOf('.update(');
    if (column >= 0 && /\.or\(/.test(chainFrom(lines, index, column))) found.add(index + 1);

    const declaration = /\b(?:let|var)\s+(\w+)\s*(?::[^=]+)?=/.exec(line);
    if (!declaration || !/\.update\(/.test(chainFrom(lines, index))) return;
    const name = declaration[1];
    const laterOr = new RegExp(`\\b${name}\\s*(?:=\\s*${name}\\s*)?\\.or\\(`);
    for (let later = index + 1; later < Math.min(lines.length, index + BUILDER_WINDOW_LINES); later += 1) {
      if (laterOr.test(lines[later])) found.add(later + 1);
    }
  });
  return [...found].sort((a, b) => a - b);
}

describe('Supabase updates never chain .or()', () => {
  it('detects the shapes it guards against', () => {
    expect(updateOrChains('db.from("t").update({ a: 1 }).eq("id", x).or(`a.is.null,a.neq.${y}`);')).toEqual([1]);
    expect(updateOrChains([
      'let query = db',
      '  .from("t")',
      '  .update(patch)',
      '  .eq("id", id)',
      '  .or("a.is.null")',
    ].join('\n'))).toEqual([3]);
    expect(updateOrChains([
      'let query = db.from("t").update(patch).eq("id", id);',
      'if (x) query = query.or("a.is.null,a.neq.1");',
    ].join('\n'))).toEqual([2]);
  });

  it('ignores or-filters on reads and updates without one', () => {
    expect(updateOrChains('db.from("t").select("id").or("a.eq.1");\ndb.from("t").update({}).in("id", ids);')).toEqual([]);
    // Semicolon-free code: a later, separate select with .or() is not part of the update.
    expect(updateOrChains([
      'await db.from("t").update({ a: 1 }).eq("id", id)',
      'const rows = await db.from("t").select("id").or("a.eq.1")',
    ].join('\n'))).toEqual([]);
    expect(updateOrChains([
      'let query = db.from("t").select("id")',
      'query = query.or("a.eq.1")',
    ].join('\n'))).toEqual([]);
  });

  it('finds no update with an or-filter in the source', () => {
    const offenders = ROOTS.flatMap((root) => sourceFiles(root).flatMap((file) =>
      updateOrChains(fs.readFileSync(file, 'utf8')).map((line) => `${file}:${line}`)));
    expect(offenders).toEqual([]);
  });
});
