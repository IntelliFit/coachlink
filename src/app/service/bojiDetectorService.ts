import { BOJI_UPLOAD_MAX_SIDE, type BojiAnalysisDto } from '@coachlink/core/src/bojiDetector';
import { isBojiScoreId, type BojiChallengeView } from '@coachlink/core/src/bojiInsights';
import type { ApiData } from '@/types/api';

/** 薄肌检测器网页端：本地压缩照片，再交给 /api/toolbox/boji/analyze。 */

export interface PreparedPhoto {
  blob: Blob;
  /** 压缩后照片的 object URL，标注坐标以它为准；不用时要 URL.revokeObjectURL */
  url: string;
  width: number;
  height: number;
}

export class BojiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'BojiRequestError';
  }
}

const JPEG_QUALITY = 0.9;

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new BojiRequestError('请选择一张照片', 400);
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) throw new BojiRequestError('这张照片无法读取，请换一张 JPG 或 PNG 照片', 400);
  const scale = Math.min(1, BOJI_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new BojiRequestError('浏览器无法处理这张照片', 400);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new BojiRequestError('浏览器无法压缩这张照片', 400);
  return { blob, url: URL.createObjectURL(blob), width, height };
}

/** challengeId：应战好友的 PK 时传对方的成绩 id */
export async function analyzeBojiPhoto(photo: Blob, challengeId?: string | null): Promise<BojiAnalysisDto> {
  const query = isBojiScoreId(challengeId) ? `?challenge=${challengeId}` : '';
  let response: Response;
  try {
    response = await fetch(`/api/toolbox/boji/analyze${query}`, {
      method: 'POST',
      body: photo,
      headers: { 'Content-Type': 'image/jpeg' },
      credentials: 'same-origin',
    });
  } catch {
    throw new BojiRequestError('网络连接失败，请稍后再试', 0);
  }
  const body = (await response.json().catch(() => null)) as ApiData<BojiAnalysisDto> | null;
  if (!response.ok || !body?.success || !body.data) {
    throw new BojiRequestError(body?.message || '检测失败，请稍后再试', response.status);
  }
  return body.data;
}

export async function fetchBojiChallenge(id: string): Promise<BojiChallengeView> {
  if (!isBojiScoreId(id)) throw new BojiRequestError('PK 链接无效', 400);
  let response: Response;
  try {
    response = await fetch(`/api/toolbox/boji/challenge/${id}`, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new BojiRequestError('网络连接失败，请稍后再试', 0);
  }
  const body = (await response.json().catch(() => null)) as ApiData<BojiChallengeView> | null;
  if (!response.ok || !body?.success || !body.data) {
    throw new BojiRequestError(body?.message || 'PK 信息打不开', response.status);
  }
  return body.data;
}

/** 分享给好友的 PK 链接 */
export function bojiChallengeUrl(scoreId: string, origin = window.location.origin): string {
  return `${origin}/toolbox/boji?challenge=${scoreId}`;
}
