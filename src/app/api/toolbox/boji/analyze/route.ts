import { NextRequest, NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import {
  analyzeWithBojiService,
  BojiServiceError,
  consumeBojiQuota,
  getBojiConfig,
  isAllowedContentType,
  normalizeContentType,
} from '@/lib/bojiDetector';
import type { ApiData } from '@/types/api';
import type { BojiAnalysisDto } from '@coachlink/core/src/bojiDetector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json<ApiData<null>>({ success: false, message, data: null }, { status, headers });
}

/**
 * 薄肌检测：请求体就是照片本身（image/jpeg、image/png、image/webp 或
 * application/octet-stream）。网页和小程序共用。照片只转发给分析服务，不保存。
 */
export async function POST(request: NextRequest) {
  const userId = await getApiUserId(request);
  if (!userId) return fail(401, '登录后才能使用薄肌检测器');

  const config = getBojiConfig();
  const contentType = normalizeContentType(request.headers.get('content-type'));
  if (!isAllowedContentType(contentType)) return fail(415, '请上传 JPG、PNG 或 WebP 格式的照片');

  const maxMb = Math.round(config.maxUploadBytes / 1024 / 1024);
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > config.maxUploadBytes) {
    return fail(413, `照片太大了，请控制在 ${maxMb} MB 以内`);
  }
  const photo = new Uint8Array(await request.arrayBuffer());
  if (photo.byteLength === 0) return fail(400, '没有收到照片');
  if (photo.byteLength > config.maxUploadBytes) return fail(413, `照片太大了，请控制在 ${maxMb} MB 以内`);

  const quota = await consumeBojiQuota(userId, config.hourlyLimit);
  if (!quota.allowed) {
    const minutes = Math.ceil(quota.retryAfterSeconds / 60);
    return fail(429, `检测太频繁了，请 ${minutes} 分钟后再试`, { 'Retry-After': String(quota.retryAfterSeconds) });
  }

  try {
    const data = await analyzeWithBojiService(photo, config);
    return NextResponse.json<ApiData<BojiAnalysisDto>>({ success: true, message: '检测完成', data });
  } catch (error) {
    if (error instanceof BojiServiceError && error.kind === 'bad_image') {
      return fail(400, '没能读取这张照片，请换一张清晰的 JPG 或 PNG 照片');
    }
    if (error instanceof BojiServiceError && error.kind === 'too_large') {
      return fail(413, '照片分辨率太高，请压缩后再试');
    }
    console.error('[boji] analysis failed:', error instanceof Error ? error.message : 'unknown error');
    return fail(503, '薄肌检测服务暂时不可用，请稍后再试');
  }
}
