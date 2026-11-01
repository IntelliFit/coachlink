/**
 * Decides what happens when a power-analysis video chunk fails: retry it, stop, or ask
 * the user. No Taro here so the rules can be unit tested (tests/power-upload-retry.test.ts).
 */

/** Statuses where sending the same chunk again cannot succeed. */
const FATAL_CHUNK_STATUSES = [401, 403, 404, 409, 410, 413]

const FIRST_RETRY_DELAY_MS = 1000

type PowerUploadError = Error & { fatal?: boolean }

/** Marked with a property: `class extends Error` loses instanceof once compiled for WeChat. */
export function powerUploadFatalError(message: string): Error {
  const error: PowerUploadError = new Error(message)
  error.fatal = true
  return error
}

export function isPowerUploadFatalError(error: unknown): boolean {
  return Boolean((error as PowerUploadError | null)?.fatal)
}

export function throwIfFatalPowerChunkStatus(status: number, message: string) {
  if (FATAL_CHUNK_STATUSES.includes(status)) throw powerUploadFatalError(message)
}

/** Sends one chunk, waiting longer each time so a short network drop can pass. */
export async function retryPowerChunk<T>(
  send: () => Promise<T>,
  options: { attempts: number; sleep: (ms: number) => Promise<unknown> }
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      return await send()
    } catch (error) {
      if (isPowerUploadFatalError(error)) throw error
      // wx.request rejects with { errMsg }; keep it for the failure report.
      lastError = error instanceof Error ? error : new Error((error as { errMsg?: string })?.errMsg || '视频分片上传失败')
    }
    if (attempt < options.attempts - 1) {
      await options.sleep(FIRST_RETRY_DELAY_MS * 2 ** attempt)
    }
  }
  throw lastError || new Error('视频分片上传失败')
}

export type PowerUploadFailurePrompt =
  | { retryable: true; title: string; content: string }
  | { retryable: false; message: string }

/** Re-uploading cannot help: the account, the limits or the job itself are the problem. */
const NOT_RETRYABLE = /登录|会员|状态已变化|过大|次数|今天已经分析|最多支持|已过期|不存在|有效的视频/
const LOCAL_FILE_PROBLEM = /读取视频|视频分片读取|临时文件/
const CONNECTION_PROBLEM = /timeout|超时|fail|interrupted|网络|连接/i

/** What to tell the user once automatic retries have run out. */
export function describePowerUploadFailure(message: string): PowerUploadFailurePrompt {
  if (NOT_RETRYABLE.test(message)) return { retryable: false, message }
  if (LOCAL_FILE_PROBLEM.test(message)) return { retryable: false, message: '视频文件读取失败，请重新选择视频' }
  const reason = CONNECTION_PROBLEM.test(message)
    ? '网络不太稳定，已经自动重试过了。连上 Wi-Fi 或换个信号好的地方，再点“重新上传”，不用重新选视频。'
    : '这次没有传完整，已经自动重试过了。点“重新上传”再试一次，不用重新选视频。'
  return { retryable: true, title: '视频没传上去', content: reason }
}
