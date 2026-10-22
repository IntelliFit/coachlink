import Taro from '@tarojs/taro'
import { BOJI_UPLOAD_MAX_SIDE, type BojiAnalysisDto } from '@coachlink/core/src/bojiDetector'
import { request } from '@/utils/request'

/**
 * 薄肌检测器（小程序）：选图 → 本地压缩到长边 1600 像素 → 以照片原始字节调用
 * 与网页相同的 POST /api/toolbox/boji/analyze。照片不经过对象存储。
 */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

export interface PreparedPhoto {
  path: string
  width: number
  height: number
}

export async function choosePhoto(source: 'album' | 'camera'): Promise<string | null> {
  try {
    const res = await Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [source],
      sizeType: ['compressed'],
    })
    return res.tempFiles?.[0]?.tempFilePath || null
  } catch {
    return null // 用户取消
  }
}

export async function preparePhoto(path: string): Promise<PreparedPhoto> {
  const info = await Taro.getImageInfo({ src: path })
  const longSide = Math.max(info.width, info.height)
  if (longSide <= BOJI_UPLOAD_MAX_SIDE) {
    return { path: info.path || path, width: info.width, height: info.height }
  }
  const scale = BOJI_UPLOAD_MAX_SIDE / longSide
  const width = Math.round(info.width * scale)
  const height = Math.round(info.height * scale)
  const compressed = await Taro.compressImage({
    src: path,
    quality: 85,
    compressedWidth: width,
    compressedHeight: height,
  })
  return { path: compressed.tempFilePath, width, height }
}

export async function analyzeBojiPhoto(path: string): Promise<BojiAnalysisDto> {
  const bytes = Taro.getFileSystemManager().readFileSync(path) as ArrayBuffer
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('照片太大了，请换一张或裁剪后再试')
  }
  const res = await request<BojiAnalysisDto>({
    url: '/api/toolbox/boji/analyze',
    method: 'POST',
    data: bytes,
    header: { 'Content-Type': 'image/jpeg' },
    showErrorToast: false,
  })
  if (!res.success || !res.data) {
    throw new Error(res.message || '检测失败，请稍后再试')
  }
  return res.data
}
