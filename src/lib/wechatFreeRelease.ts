import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  WECHAT_FREE_RELEASE,
  WECHAT_FREE_RELEASE_HEADER,
  WECHAT_FREE_RELEASE_ID,
  WECHAT_PURCHASE_PAUSED_MESSAGE,
} from '@coachlink/core';

type RequestHeaders = Pick<Request, 'headers'>;

function isFreeClient(request: RequestHeaders) {
  return request.headers.get(WECHAT_FREE_RELEASE_HEADER) === WECHAT_FREE_RELEASE_ID;
}

/** Public product policy only; never use this marker for authentication/ownership. */
export async function isWechatFreeRequest(request?: RequestHeaders): Promise<boolean> {
  if (!WECHAT_FREE_RELEASE) return false;
  if (request) return isFreeClient(request);
  try {
    return isFreeClient({ headers: await headers() });
  } catch {
    // Background jobs and non-request callers keep their existing paid policy.
    return false;
  }
}

/** Must run before parsing/creating orders or invoking a payment provider. */
export function rejectWechatPurchase(
  request: RequestHeaders,
  options: { wechatOnly?: boolean; message?: string } = {},
) {
  // Old free clients stay unable to charge even after a new paid API release.
  if (!isFreeClient(request) && !(options.wechatOnly && WECHAT_FREE_RELEASE)) return null;
  return NextResponse.json(
    { success: false, code: 'WECHAT_FREE_RELEASE', message: options.message || WECHAT_PURCHASE_PAUSED_MESSAGE, data: null },
    { status: 403 },
  );
}
