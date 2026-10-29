import { AppState } from 'react-native'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { apiClient } from '../api'
import {
  enableMobilePush,
  Notifications,
  setApplicationBadge,
  syncExistingMobilePush,
  type MobilePushState,
} from '../notifications/mobileNotifications'
import { flushPendingNotificationTarget, queueNotificationTarget } from '../navigation/navigationRef'
import { announcementFeed, useAnnouncementFeed } from '../notifications/announcementFeed'
import { notificationRefreshesAnnouncements, parseNotificationTarget } from '../notifications/notificationTargets'
import { useAuth } from './AuthProvider'

const MESSAGE_POLL_INTERVAL_MS = 12_000
/** 公告变化不频繁：回到前台或超过这个时间才重新拉。 */
const ANNOUNCEMENT_MAX_AGE_MS = 5 * 60_000

type MessageCenterContextValue = {
  /** 聊天未读条数。 */
  unreadCount: number
  /** 平台公告未读条数。 */
  announcementUnreadCount: number
  /** 「我的」Tab 和桌面角标显示的总数：聊天未读 + 公告未读。 */
  totalUnreadCount: number
  refreshUnreadCount: () => Promise<number>
  setUnreadCount: (count: number) => void
  pushState: MobilePushState | null
  enablingPush: boolean
  enableNotifications: () => Promise<MobilePushState>
}

const MessageCenterContext = createContext<MessageCenterContextValue | null>(null)

export function MessageCenterProvider({ children }: PropsWithChildren) {
  const { isAuthenticated, user } = useAuth()
  const [unreadCount, setUnreadCountState] = useState(0)
  const [pushState, setPushState] = useState<MobilePushState | null>(null)
  const [enablingPush, setEnablingPush] = useState(false)
  const inFlightRef = useRef<Promise<number> | null>(null)
  const unreadRef = useRef(0)
  const announcementUserRef = useRef('')
  const { unreadCount: announcementUnreadCount } = useAnnouncementFeed()
  const totalUnreadCount = unreadCount + (isAuthenticated ? announcementUnreadCount : 0)

  const setUnreadCount = useCallback((count: number) => {
    const next = Math.max(0, Math.floor(Number(count) || 0))
    unreadRef.current = next
    setUnreadCountState(next)
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      unreadRef.current = 0
      setUnreadCountState(0)
      return 0
    }
    if (inFlightRef.current) return inFlightRef.current

    const request = apiClient
      .request<{ totalUnread?: number }>('/api/chat/get-unread-count', { method: 'GET', timeoutMs: 10_000 })
      .then((data) => {
        const next = Math.max(0, Math.floor(Number(data.totalUnread) || 0))
        unreadRef.current = next
        setUnreadCountState(next)
        return next
      })
      .catch(() => unreadRef.current)
      .finally(() => {
        inFlightRef.current = null
      })
    inFlightRef.current = request
    return request
  }, [isAuthenticated, user?.id])

  const enableNotifications = useCallback(async () => {
    if (!user?.id) {
      const state: MobilePushState = { permission: 'unavailable', registration: 'unavailable', message: '请先登录后开启消息通知。' }
      setPushState(state)
      return state
    }
    setEnablingPush(true)
    try {
      const state = await enableMobilePush(user.id)
      setPushState(state)
      return state
    } finally {
      setEnablingPush(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      unreadRef.current = 0
      setUnreadCountState(0)
      setPushState(null)
      if (announcementUserRef.current) {
        announcementUserRef.current = ''
        announcementFeed.reset()
      }
      return undefined
    }
    if (announcementUserRef.current !== user.id) {
      // 切换账号：清掉上一个账号的公告和已弹记录，再按新账号拉取。
      if (announcementUserRef.current) announcementFeed.reset()
      announcementUserRef.current = user.id
    }

    const refreshWhenActive = () => {
      if (AppState.currentState !== 'active') return
      void refreshUnreadCount()
      void announcementFeed.load(ANNOUNCEMENT_MAX_AGE_MS)
    }
    refreshWhenActive()
    const interval = setInterval(refreshWhenActive, MESSAGE_POLL_INTERVAL_MS)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      void refreshUnreadCount()
      void announcementFeed.load()
    })
    return () => {
      clearInterval(interval)
      subscription.remove()
    }
  }, [isAuthenticated, refreshUnreadCount, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    let cancelled = false
    void syncExistingMobilePush(user.id)
      .then((state) => {
        if (!cancelled) setPushState(state)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  useEffect(() => {
    void setApplicationBadge(isAuthenticated ? totalUnreadCount : 0)
  }, [isAuthenticated, totalUnreadCount])

  useEffect(() => {
    const handleResponse = (data: Record<string, unknown> | undefined) => {
      const target = parseNotificationTarget(data)
      if (!target) return
      queueNotificationTarget(target)
      flushPendingNotificationTarget(isAuthenticated)
    }
    const refreshFor = (data: Record<string, unknown> | undefined) => {
      void refreshUnreadCount()
      if (isAuthenticated && notificationRefreshesAnnouncements(data)) void announcementFeed.load()
    }

    const received = Notifications.addNotificationReceivedListener((notification) => {
      refreshFor(notification.request.content.data)
    })
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response.notification.request.content.data)
      refreshFor(response.notification.request.content.data)
    })
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return
      handleResponse(response.notification.request.content.data)
      void Notifications.clearLastNotificationResponseAsync()
    })
    return () => {
      received.remove()
      responded.remove()
    }
  }, [isAuthenticated, refreshUnreadCount])

  const value = useMemo<MessageCenterContextValue>(() => ({
    unreadCount,
    announcementUnreadCount: isAuthenticated ? announcementUnreadCount : 0,
    totalUnreadCount,
    refreshUnreadCount,
    setUnreadCount,
    pushState,
    enablingPush,
    enableNotifications,
  }), [announcementUnreadCount, enableNotifications, enablingPush, isAuthenticated, pushState, refreshUnreadCount, setUnreadCount, totalUnreadCount, unreadCount])

  return <MessageCenterContext.Provider value={value}>{children}</MessageCenterContext.Provider>
}

export function useMessageCenter() {
  const value = useContext(MessageCenterContext)
  if (!value) throw new Error('useMessageCenter must be used within MessageCenterProvider')
  return value
}
