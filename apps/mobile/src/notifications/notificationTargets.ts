/**
 * 系统通知点击后去哪：服务端推送只带 kind 和少量 id（见 src/lib/processMobileNotificationOutbox.ts），
 * 这里校验 id 格式后映射到 APP 路由，未知 kind 统一打开消息中心。
 */

export type NotificationTarget =
  | { name: 'Chat'; params: { roomId: string } }
  | { name: 'AnnouncementDetail'; params: { id: string } }
  | { name: 'Announcements' }
  | { name: 'Friends'; params?: { tab: 'requests' } }
  | { name: 'CoachStudents' }
  | { name: 'CoachPayments' }
  | { name: 'CoachVideos' }
  | { name: 'Messages' }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid(value: unknown) {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : ''
}

export function parseNotificationTarget(data: Record<string, unknown> | null | undefined): NotificationTarget | null {
  if (!data || typeof data !== 'object') return null
  const kind = typeof data.kind === 'string' ? data.kind : ''
  switch (kind) {
    case 'chat_message': {
      const roomId = uuid(data.roomId)
      return roomId ? { name: 'Chat', params: { roomId } } : { name: 'Messages' }
    }
    case 'announcement': {
      const id = uuid(data.announcementId)
      return id ? { name: 'AnnouncementDetail', params: { id } } : { name: 'Announcements' }
    }
    case 'friend_request':
      return { name: 'Friends', params: { tab: 'requests' } }
    case 'friend_accepted':
      return { name: 'Friends' }
    case 'coach_payment_pending':
      return { name: 'CoachPayments' }
    case 'coach_new_student':
      return { name: 'CoachStudents' }
    case 'coach_video_submitted':
      return { name: 'CoachVideos' }
    case '':
      return null
    default:
      return { name: 'Messages' }
  }
}

/** 收到通知时哪些需要顺便刷新公告缓存（红点和首页通知栏）。 */
export function notificationRefreshesAnnouncements(data: Record<string, unknown> | null | undefined) {
  return Boolean(data && data.kind === 'announcement')
}
