import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appendPcmToMp4, listBoxes } from '../apps/wechat/src/toolbox/happy-bird/mp4PcmTrack';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const dir = hasFfmpeg ? mkdtempSync(path.join(tmpdir(), 'mp4-pcm-')) : '';
const RATE = 22050;

afterAll(() => {
  if (dir) rmSync(dir, { force: true, recursive: true });
});

/** 生成一段只有画面的 H.264 视频，和微信画布录制器的输出一样没有音轨。 */
function makeVideo(name: string, extraArgs: string[], seconds = 3) {
  const file = path.join(dir, name);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc=size=320x576:rate=20:duration=${seconds}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '20',
    ...extraArgs, file
  ]);
  return new Uint8Array(readFileSync(file));
}

function tone(seconds: number) {
  const pcm = new Int16Array(Math.round(seconds * RATE));
  for (let index = 0; index < pcm.length; index += 1) pcm[index] = Math.round(Math.sin((index / RATE) * 2 * Math.PI * 440) * 12000);
  return pcm;
}

function probe(file: string) {
  return JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
}

function decodeAudio(file: string) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a', '-f', 's16le', '-acodec', 'pcm_s16le', '-'], { maxBuffer: 1 << 28 });
  return new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
}

function decodeVideoHash(file: string) {
  return execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-f', 'md5', '-'], { encoding: 'utf8' }).trim();
}

function writeOut(name: string, bytes: Uint8Array) {
  const file = path.join(dir, name);
  writeFileSync(file, bytes);
  return file;
}

describe.skipIf(!hasFfmpeg)('adding a PCM track to a silent MP4 without re-encoding', () => {
  it.each([
    ['moov at the end (plain recorder output)', 'end.mp4', []],
    ['moov at the front (faststart)', 'front.mp4', ['-movflags', '+faststart']]
  ])('%s: audio plays, matches sample for sample, and the picture is untouched', (_label, name, args) => {
    const source = makeVideo(name, args as string[]);
    const sourceFile = path.join(dir, name);
    const pcm = tone(3);
    const merged = writeOut(`merged-${name}`, appendPcmToMp4(source, pcm, RATE));

    const info = probe(merged);
    const audio = info.streams.find((stream: any) => stream.codec_type === 'audio');
    expect(audio.codec_name).toBe('pcm_s16le');
    expect(Number(audio.sample_rate)).toBe(RATE);
    expect(Number(audio.channels)).toBe(1);
    expect(Number(audio.duration)).toBeCloseTo(3, 1);
    expect(Number(info.format.duration)).toBeCloseTo(3, 1);

    expect(Array.from(decodeAudio(merged))).toEqual(Array.from(pcm));
    expect(decodeVideoHash(merged)).toBe(decodeVideoHash(sourceFile));
    // 解码整段不报错
    expect(spawnSync('ffmpeg', ['-v', 'error', '-i', merged, '-f', 'null', '-'], { encoding: 'utf8' }).stderr).toBe('');
  });

  it('only appends: the original bytes stay in place except the moov name', () => {
    const source = makeVideo('stable.mp4', []);
    const merged = appendPcmToMp4(source, tone(1), RATE);
    const moov = listBoxes((offset, length) => source.subarray(offset, offset + length), 0, source.length).find((item) => item.type === 'moov')!;
    const changed: number[] = [];
    for (let index = 0; index < source.length; index += 1) if (source[index] !== merged[index]) changed.push(index);
    expect(changed).toEqual([moov.offset + 4, moov.offset + 5, moov.offset + 6, moov.offset + 7]);
    expect(merged.length).toBeGreaterThan(source.length + 2 * RATE);
  });

  it('handles audio that spans several one-second chunks with a short last chunk', () => {
    const source = makeVideo('chunks.mp4', [], 4);
    const pcm = tone(3.7);
    const merged = writeOut('merged-chunks.mp4', appendPcmToMp4(source, pcm, RATE));
    expect(Array.from(decodeAudio(merged))).toEqual(Array.from(pcm));
  });

  it('keeps the longer of video and audio as the movie length', () => {
    const source = makeVideo('short-audio.mp4', [], 3);
    const merged = writeOut('merged-short-audio.mp4', appendPcmToMp4(source, tone(1), RATE));
    expect(Number(probe(merged).format.duration)).toBeCloseTo(3, 1);
  });

  it('refuses fragmented recordings instead of writing a broken file', () => {
    const source = makeVideo('fragmented.mp4', ['-movflags', '+frag_keyframe+empty_moov']);
    expect(() => appendPcmToMp4(source, tone(1), RATE)).toThrow(/分片/);
  });

  it('refuses files it cannot parse', () => {
    expect(() => appendPcmToMp4(new Uint8Array([0, 0, 0, 40, 109, 111, 111, 118]), tone(1), RATE)).toThrow();
  });
});
