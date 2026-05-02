import Taro from '@tarojs/taro'
import { chatService } from '@/services/chatService'
import { coachService } from '@/services/coach/coachService'

type ResolveCoachChatUserIdParams = {
  coachId?: string | null
  coachUserId?: string | null
}

type OpenCoachChatParams = ResolveCoachChatUserIdParams & {
  currentUserId?: string | null
  coachName?: string | null
  fallbackToMessagesList?: boolean
}

export async function resolveCoachChatUserId(params: ResolveCoachChatUserIdParams): Promise<string> {
  const coachUserId = String(params.coachUserId || '').trim()
  if (coachUserId) return coachUserId

  const coachId = String(params.coachId || '').trim()
  if (!coachId) return ''

  try {
    const aggregated = await coachService.getAggregatedInfo({ coachId })
    return String(aggregated?.coach?.user_id || '').trim()
  } catch (error) {
    console.error('[coach-chat] resolve coach user id failed:', error)
    return ''
  }
}

function buildMessagesPageUrl(params: {
  coachId?: string | null
  coachUserId?: string | null
  coachName?: string | null
}) {
  const query = [
    params.coachUserId ? `peerUserId=${encodeURIComponent(params.coachUserId)}` : '',
    params.coachId ? `coachId=${encodeURIComponent(params.coachId)}` : '',
    params.coachName ? `coachName=${encodeURIComponent(params.coachName)}` : ''
  ]
    .filter(Boolean)
    .join('&')

  return query ? `/me/messages/index?${query}` : '/me/messages/index'
}

export async function openCoachChat(params: OpenCoachChatParams): Promise<boolean> {
  const currentUserId = String(params.currentUserId || '').trim()
  if (!currentUserId) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    return false
  }

  const coachId = String(params.coachId || '').trim()
  const coachName = String(params.coachName || '').trim() || '教练'
  const coachUserId = await resolveCoachChatUserId({
    coachId,
    coachUserId: params.coachUserId
  })

  if (!coachUserId) {
    if (params.fallbackToMessagesList && coachId) {
      await Taro.navigateTo({
        url: buildMessagesPageUrl({ coachId, coachName })
      })
      return true
    }

    Taro.showToast({ title: '教练账号信息缺失', icon: 'none' })
    return false
  }

  if (coachUserId === currentUserId) {
    Taro.showToast({ title: '无法与自己发起会话', icon: 'none' })
    return false
  }

  try {
    const room = await chatService.getChatroom({ members: [currentUserId, coachUserId] })
    if (room?.id) {
      await Taro.navigateTo({
        url: `/me/messages/chat/index?roomId=${room.id}&peerName=${encodeURIComponent(coachName)}`
      })
      return true
    }
  } catch (error) {
    console.error('[coach-chat] open coach chat failed:', error)
  }

  if (params.fallbackToMessagesList) {
    await Taro.navigateTo({
      url: buildMessagesPageUrl({
        coachId,
        coachUserId,
        coachName
      })
    })
    return true
  }

  Taro.showToast({ title: '打开会话失败，请稍后重试', icon: 'none' })
  return false
}
