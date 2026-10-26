import Taro from '@tarojs/taro'
import { request } from '@/utils/request'

/**
 * Tells the server why a job never reached the queue (failed upload, user left), so
 * usage reviews can tell an upload bug from a user who changed their mind.
 * Same contract as the Web page: POST /api/toolbox/power-analysis/jobs/:id/client-event.
 */
export type PowerClientEventName = 'upload_failed' | 'left_during_upload' | 'left_without_start'

function clientInfo(): Record<string, string> {
  try {
    const device = Taro.getDeviceInfo?.()
    const app = Taro.getAppBaseInfo?.()
    return {
      platform: String(device?.platform || ''),
      brand: String(device?.brand || ''),
      model: String(device?.model || ''),
      system: String(device?.system || ''),
      wechatVersion: String(app?.version || ''),
      sdkVersion: String(app?.SDKVersion || '')
    }
  } catch {
    return {}
  }
}

export function reportPowerClientEvent(
  jobId: string | null | undefined,
  event: PowerClientEventName,
  details: { stage?: string; message?: string; progress?: number } = {}
) {
  if (!jobId) return
  request({
    url: `/api/toolbox/power-analysis/jobs/${jobId}/client-event`,
    method: 'POST',
    data: { event, ...details, client: clientInfo() },
    showErrorToast: false
  }).catch(() => undefined)
}
