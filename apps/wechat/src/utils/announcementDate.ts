import { formatBeijingDate } from '@coachlink/core/src/beijingTime'

export function formatAnnouncementDate(iso: string, withTime = false): string {
  return formatBeijingDate(iso, 'zh-CN', withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' })
}
