import Taro from '@tarojs/taro'

export interface ActionTeachingData {
  id: string
  name: string
  detail?: string | null
  positions?: string[] | null
  attrs?: string[] | null
  type?: string | null
  url?: string | null
  video_url?: string | null
  reference_image_url?: string | null
}

/** Read-only navigation: teaching must never create an execution or start its timer. */
export function openActionTeaching(action: ActionTeachingData, context: {
  instanceId?: string
  dayIndex?: number
  actionIndex?: number
  coachNote?: string
} = {}) {
  const query = [`id=${encodeURIComponent(action.id)}`]
  if (context.instanceId) query.push(`instanceId=${encodeURIComponent(context.instanceId)}`)
  if (context.dayIndex) query.push(`dayIndex=${context.dayIndex}`)
  if (context.actionIndex !== undefined) query.push(`actionIndex=${context.actionIndex}`)
  return Taro.navigateTo({
    url: `/training/action-detail?${query.join('&')}`,
    success: res => res.eventChannel.emit('teaching', { action, coachNote: context.coachNote || '' })
  }).catch(() => Taro.showToast({ title: '打开讲解失败，请重试', icon: 'none' }))
}
