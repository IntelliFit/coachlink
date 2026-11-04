/**
 * 不重新编码，往录好的 MP4 里加一条未压缩的 16 位单声道音轨。
 *
 * 微信的合成接口会把整段视频重新编码，真机上要几分钟还常失败。这里画面数据一个字节不动：
 * 原来的 moov 原地改成 free（视频偏移全部不变），文件末尾追加音频 mdat 和新的 moov。
 * 手机上没有给小程序用的音频压缩接口，所以写 PCM（QuickTime 的 sowt）。
 * 纯逻辑，读文件和写文件由调用方提供，方便在 Node 里用真实 MP4 测试。
 */

export type BoxHeader = {
  headerSize: number
  offset: number
  size: number
  type: string
}

export type ReadAt = (offset: number, length: number) => Uint8Array

export type FilePatch = { bytes: Uint8Array; position: number }

export type PcmAppendPlan = {
  /** 按顺序追加到文件末尾。 */
  appendParts: Uint8Array[]
  /** 复制原文件后，先在这些位置原地覆盖。 */
  patches: FilePatch[]
}

const CHUNK_SECONDS = 1
const UINT32_MAX = 0xffffffff

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]
}

function readUint64(bytes: Uint8Array, offset: number) {
  return readUint32(bytes, offset) * 2 ** 32 + readUint32(bytes, offset + 4)
}

function readType(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

export function readBoxHeader(bytes: Uint8Array, offset: number, limit: number): BoxHeader {
  const declared = readUint32(bytes, 0)
  const type = readType(bytes, 4)
  if (declared === 1) return { headerSize: 16, offset, size: readUint64(bytes, 8), type }
  // size 0 表示一直到文件结尾
  return { headerSize: 8, offset, size: declared === 0 ? limit - offset : declared, type }
}

/** 列出顶层 box；遇到坏数据（尺寸越界或过小）直接报错，调用方退回无声视频。 */
export function listBoxes(readAt: ReadAt, start: number, end: number): BoxHeader[] {
  const boxes: BoxHeader[] = []
  let offset = start
  while (offset + 8 <= end) {
    const header = readBoxHeader(readAt(offset, Math.min(16, end - offset)), offset, end)
    if (header.size < header.headerSize || offset + header.size > end) {
      throw new Error(`视频结构读不懂：${header.type} @${offset}`)
    }
    boxes.push(header)
    offset += header.size
  }
  return boxes
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach((part) => {
    out.set(part, offset)
    offset += part.length
  })
  return out
}

function u8(value: number) {
  return Uint8Array.of(value & 0xff)
}

function u16(value: number) {
  return Uint8Array.of((value >>> 8) & 0xff, value & 0xff)
}

function u32(value: number) {
  return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)
}

function u64(value: number) {
  return concat([u32(Math.floor(value / 2 ** 32)), u32(value % 2 ** 32)])
}

function ascii(text: string) {
  return Uint8Array.from(text.split('').map((char) => char.charCodeAt(0)))
}

function box(type: string, ...payload: Uint8Array[]) {
  const body = concat(payload)
  return concat([u32(body.length + 8), ascii(type), body])
}

function fullBox(type: string, version: number, flags: number, ...payload: Uint8Array[]) {
  return box(type, u8(version), u8(flags >>> 16), u16(flags & 0xffff), ...payload)
}

function zeros(length: number) {
  return new Uint8Array(length)
}

type Mvhd = { duration: number; nextTrackId: number; timescale: number; version: number }

function parseMvhd(body: Uint8Array): Mvhd {
  const version = body[0]
  const timescale = version === 1 ? readUint32(body, 20) : readUint32(body, 12)
  const duration = version === 1 ? readUint64(body, 24) : readUint32(body, 16)
  return { duration, nextTrackId: readUint32(body, body.length - 4), timescale, version }
}

function patchMvhd(body: Uint8Array, mvhd: Mvhd, duration: number) {
  const out = body.slice()
  if (mvhd.version === 1) out.set(u64(duration), 24)
  else out.set(u32(Math.min(UINT32_MAX, duration)), 16)
  out.set(u32(mvhd.nextTrackId + 1), out.length - 4)
  return out
}

const UNITY_MATRIX = concat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32))

type AudioLayout = {
  chunkOffsets: number[]
  sampleCount: number
  sampleRate: number
  samplesPerChunk: number
}

function buildSampleTable(layout: AudioLayout) {
  const { chunkOffsets, sampleCount, sampleRate, samplesPerChunk } = layout
  const lastChunkSamples = sampleCount - samplesPerChunk * (chunkOffsets.length - 1)
  const stscEntries = lastChunkSamples === samplesPerChunk || chunkOffsets.length === 1
    ? [[1, chunkOffsets.length === 1 ? sampleCount : samplesPerChunk]]
    : [[1, samplesPerChunk], [chunkOffsets.length, lastChunkSamples]]
  // QuickTime SoundDescription v0：sowt = 16 位小端 PCM，各家播放器和抖音上传都认。
  const sowt = box(
    'sowt',
    zeros(6), u16(1),
    u16(0), u16(0), u32(0),
    u16(1), u16(16), u16(0), u16(0),
    u32(sampleRate * 65536)
  )
  const large = chunkOffsets[chunkOffsets.length - 1] > UINT32_MAX
  return box(
    'stbl',
    fullBox('stsd', 0, 0, u32(1), sowt),
    fullBox('stts', 0, 0, u32(1), u32(sampleCount), u32(1)),
    fullBox('stsc', 0, 0, u32(stscEntries.length), ...stscEntries.map(([first, count]) => concat([u32(first), u32(count), u32(1)]))),
    fullBox('stsz', 0, 0, u32(2), u32(sampleCount)),
    large
      ? fullBox('co64', 0, 0, u32(chunkOffsets.length), ...chunkOffsets.map(u64))
      : fullBox('stco', 0, 0, u32(chunkOffsets.length), ...chunkOffsets.map(u32))
  )
}

function buildAudioTrak(trackId: number, movieDuration: number, layout: AudioLayout) {
  const tkhd = fullBox(
    'tkhd', 0, 0x000003,
    u32(0), u32(0), u32(trackId), u32(0), u32(Math.min(UINT32_MAX, movieDuration)),
    zeros(8), u16(0), u16(0), u16(0x0100), u16(0),
    UNITY_MATRIX, u32(0), u32(0)
  )
  const mdhd = fullBox('mdhd', 0, 0, u32(0), u32(0), u32(layout.sampleRate), u32(layout.sampleCount), u16(0x55c4), u16(0))
  const hdlr = fullBox('hdlr', 0, 0, u32(0), ascii('soun'), zeros(12), ascii('SoundHandler'), u8(0))
  const minf = box(
    'minf',
    fullBox('smhd', 0, 0, u16(0), u16(0)),
    box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
    buildSampleTable(layout)
  )
  return box('trak', tkhd, box('mdia', mdhd, hdlr, minf))
}

function containsBox(bytes: Uint8Array, start: number, end: number, wanted: string): boolean {
  const children = listBoxes((offset, length) => bytes.subarray(offset, offset + length), start, end)
  return children.some((child) => {
    if (child.type === wanted) return true
    if (child.type === 'trak' || child.type === 'mvex') return containsBox(bytes, child.offset + child.headerSize, child.offset + child.size, wanted)
    return false
  })
}

/** 在原 moov 后面加一条音轨，返回新的 moov。 */
export function buildMoovWithAudio(moov: Uint8Array, layout: AudioLayout) {
  const header = readBoxHeader(moov, 0, moov.length)
  const children = listBoxes((offset, length) => moov.subarray(offset, offset + length), header.headerSize, moov.length)
  const mvhdBox = children.find((child) => child.type === 'mvhd')
  if (!mvhdBox) throw new Error('视频结构读不懂：没有 mvhd')
  if (children.some((child) => child.type === 'mvex')) throw new Error('录制的视频是分片格式，暂不支持写入声音')

  const mvhdBody = moov.subarray(mvhdBox.offset + mvhdBox.headerSize, mvhdBox.offset + mvhdBox.size)
  const mvhd = parseMvhd(mvhdBody)
  const audioDuration = Math.ceil((layout.sampleCount / layout.sampleRate) * mvhd.timescale)
  const parts = children.map((child) => {
    if (child !== mvhdBox) return moov.subarray(child.offset, child.offset + child.size)
    return box('mvhd', patchMvhd(mvhdBody, mvhd, Math.max(mvhd.duration, audioDuration)))
  })
  return box('moov', ...parts, buildAudioTrak(mvhd.nextTrackId, audioDuration, layout))
}

/**
 * 算出怎么改原文件：moov 原地改名 free；如果最后一个 box 的尺寸写的是 0（到文件尾），补成真实尺寸，
 * 不然后面追加的数据会被当成它的一部分。然后追加 [音频 mdat][新 moov]。
 */
export function planPcmAppend(readAt: ReadAt, fileSize: number, pcm: Int16Array, sampleRate: number): PcmAppendPlan {
  const boxes = listBoxes(readAt, 0, fileSize)
  const moovBox = boxes.find((item) => item.type === 'moov')
  if (!moovBox) throw new Error('视频结构读不懂：没有 moov')
  if (boxes.some((item) => item.type === 'moof')) throw new Error('录制的视频是分片格式，暂不支持写入声音')

  const moov = readAt(moovBox.offset, moovBox.size)
  if (containsBox(moov, moovBox.headerSize, moov.length, 'sowt')) throw new Error('视频里已经有这条音轨')

  const patches: FilePatch[] = [{ bytes: ascii('free'), position: moovBox.offset + 4 }]
  const last = boxes[boxes.length - 1]
  if (readUint32(readAt(last.offset, 4), 0) === 0) {
    if (last.size > UINT32_MAX) throw new Error('视频太大，暂不支持写入声音')
    patches.push({ bytes: u32(last.size), position: last.offset })
  }

  const pcmBytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const large = pcmBytes.length + 8 > UINT32_MAX
  const mdatHeader = large
    ? concat([u32(1), ascii('mdat'), u64(pcmBytes.length + 16)])
    : concat([u32(pcmBytes.length + 8), ascii('mdat')])
  const dataStart = fileSize + mdatHeader.length
  const samplesPerChunk = Math.max(1, Math.round(sampleRate * CHUNK_SECONDS))
  const chunkCount = Math.max(1, Math.ceil(pcm.length / samplesPerChunk))
  const chunkOffsets = Array.from({ length: chunkCount }, (_, index) => dataStart + index * samplesPerChunk * 2)
  const newMoov = buildMoovWithAudio(moov, { chunkOffsets, sampleCount: pcm.length, sampleRate, samplesPerChunk })
  return { appendParts: [mdatHeader, pcmBytes, newMoov], patches }
}

/** 整个文件在内存里时用（测试和兜底）：按计划生成新文件。 */
export function appendPcmToMp4(file: Uint8Array, pcm: Int16Array, sampleRate: number) {
  const plan = planPcmAppend((offset, length) => file.subarray(offset, offset + length), file.length, pcm, sampleRate)
  const patched = file.slice()
  plan.patches.forEach((patch) => patched.set(patch.bytes, patch.position))
  return concat([patched, ...plan.appendParts])
}
