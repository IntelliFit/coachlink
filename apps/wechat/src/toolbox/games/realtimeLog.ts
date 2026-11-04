declare const wx: any

/**
 * 写进小程序后台「实时日志」，用来看真机上的耗时和识别频率。只放排查用的数字，不放个人信息。
 * 日志只是排查用，写不进去不影响功能。
 */
export function realtimeLog(level: 'info' | 'warn', tag: string, payload: Record<string, unknown>) {
  try {
    const manager = typeof wx !== 'undefined' ? wx.getRealtimeLogManager?.() : null
    manager?.[level]?.(tag, payload)
  } catch {
    // ignore
  }
}
