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
import { flushPendingNotificationChat, queueNotificationChat } from '../navigation/navigationRef'
import { useAuth } from './AuthProvider'

const MESSAGE_POLL_INTERVAL_MS = 12_000

type MessageCenterContextValue = {
  unreadCount: number
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
      return undefined
    }

    const refreshWhenActive = () => {
      if (AppState.currentState === 'active') void refreshUnreadCount()
    }
    refreshWhenActive()
    const interval = setInterval(refreshWhenActive, MESSAGE_POLL_INTERVAL_MS)
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadCount()
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
    void setApplicationBadge(isAuthenticated ? unreadCount : 0)
  }, [isAuthenticated, unreadCount])

  useEffect(() => {
    const handleResponse = (data: Record<string, unknown> | undefined) => {
      if (!data) return
      const roomId = typeof data.roomId === 'string' ? data.roomId : ''
      if (data.kind !== 'chat_message' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId)) return
      queueNotificationChat(roomId)
      flushPendingNotificationChat(isAuthenticated)
    }

    const received = Notifications.addNotificationReceivedListener(() => {
      void refreshUnreadCount()
    })
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response.notification.request.content.data)
      void refreshUnreadCount()
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
    refreshUnreadCount,
    setUnreadCount,
    pushState,
    enablingPush,
    enableNotifications,
  }), [enableNotifications, enablingPush, pushState, refreshUnreadCount, setUnreadCount, unreadCount])

  return <MessageCenterContext.Provider value={value}>{children}</MessageCenterContext.Provider>
}

export function useMessageCenter() {
  const value = useContext(MessageCenterContext)
  if (!value) throw new Error('useMessageCenter must be used within MessageCenterProvider')
  return value
}
