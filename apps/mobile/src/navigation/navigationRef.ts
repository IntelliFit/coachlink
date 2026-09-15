import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './types'

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>()

let pendingChatRoomId = ''

export function queueNotificationChat(roomId: string) {
  pendingChatRoomId = roomId
}

export function flushPendingNotificationChat(isAuthenticated: boolean) {
  if (!isAuthenticated || !pendingChatRoomId || !rootNavigationRef.isReady()) return false
  const roomId = pendingChatRoomId
  pendingChatRoomId = ''
  rootNavigationRef.navigate('Chat', { roomId })
  return true
}
