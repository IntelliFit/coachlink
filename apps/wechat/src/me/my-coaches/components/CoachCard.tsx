import { View, Text, Image } from '@tarojs/components'
import { WECHAT_COACH_PURCHASE_PAUSED } from '@coachlink/core'
import type { QueryCoachSubscription, GetAggregatedInfoResponseDto, StatusThemeKey, StatusTheme } from '../types'
import './CoachCard.scss'
import { Message } from '@nutui/icons-react-taro'

const STATUS_THEME: Record<StatusThemeKey, StatusTheme> = {
  active: { bg: '#d1fae5', text: '#059669', label: '已激活' },
  preparing: { bg: '#fef3c7', text: '#d97706', label: '制定中' },
  not_started: { bg: '#f3f4f6', text: '#6b7280', label: '未开始' },
  expired: { bg: '#e5e7eb', text: '#6b7280', label: '已过期' },
  expiring: { bg: '#fef3c7', text: '#d97706', label: '即将到期' },
  waiting: { bg: '#fef3c7', text: '#d97706', label: '待确认' },
  inactive: { bg: '#fee2e2', text: '#dc2626', label: WECHAT_COACH_PURCHASE_PAUSED ? '未激活' : '待支付' }
}

function getStatusKey(sub: QueryCoachSubscription): StatusThemeKey {
  if (sub.status === 'inactive') return 'inactive'
  if (sub.status === 'waiting') return 'waiting'
  if (sub.status === 'active') {
    const remainingCredits = Number(sub.entitlement_remaining_credits ?? NaN)
    const hasRemainingCredits = Number.isFinite(remainingCredits) && remainingCredits > 0
    if (sub.lifecycle_status === 'expired_grace' && !hasRemainingCredits) return 'expiring'
    if (sub.lifecycle_status === 'expired_cancelled' && !hasRemainingCredits) return 'expired'
    const hasPlan = (sub as any).has_plan_instance
    if (hasPlan === false) return 'preparing'
    if (!sub.start_date) return 'not_started'
    if (hasRemainingCredits) return 'active'
    if (!sub.end_date) return 'active'
  }
  if (!sub.end_date) return 'active'
  const days = Math.ceil((new Date(sub.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'expired'
  if (days <= 7) return 'expiring'
  return 'active'
}

interface CoachCardProps {
  subscription: QueryCoachSubscription
  aggregated?: GetAggregatedInfoResponseDto | null
  onDetail: (coachId: string) => void
  onRenew: (coachId: string) => void
  onConsult: (coachId: string) => void
}

export default function CoachCard({ subscription, aggregated, onDetail, onRenew, onConsult }: CoachCardProps) {
  const coach = subscription.coach
  const statusKey = getStatusKey(subscription)
  const theme = STATUS_THEME[statusKey]
  const specialties = aggregated?.specialties?.length ? aggregated.specialties : (coach?.specialties || [])
  const daysLeft = subscription.end_date
    ? Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const isExpiring = statusKey === 'expiring'

  const showDaysBadge = statusKey === 'active' && daysLeft !== null
  const subtitle = coach?.title || (coach?.bio ? coach.bio.replace(/\s+/g, ' ').slice(0, 28) + (coach.bio.length > 28 ? '…' : '') : '专业认证教练')

  return (
    <View className='coach-card'>
      <View className='card-header'>
        <View className='card-header-left'>
          <View className='avatar-wrap'>
            <View className='avatar-container'>
              {coach?.avatar_url ? (
                <Image
                  src={coach.avatar_url}
                  mode='aspectFill'
                  className='avatar-image'
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <View className='avatar-placeholder'>
                  <Text className='avatar-text'>{coach?.name?.charAt(0)?.toUpperCase() || 'C'}</Text>
                </View>
              )}
            </View>
            <View className={`status-dot ${statusKey === 'active' ? 'status-dot-active' : ''}`} />
          </View>
          <View className='card-meta'>
            <Text className='coach-name'>{coach?.name || '未知教练'}</Text>
            <Text className='coach-title'>{subtitle}</Text>
          </View>
        </View>
        <View
          className={`status-tag ${showDaysBadge ? 'status-tag-days' : ''}`}
          style={{ backgroundColor: theme.bg, color: theme.text }}
        >
          {showDaysBadge ? (
            <>
              <Text className='status-tag-line1'>剩余</Text>
              <Text className='status-tag-line2'>{daysLeft}天</Text>
            </>
          ) : (
            <Text>{theme.label}</Text>
          )}
        </View>
      </View>

      <View className='metrics-row'>
        <View className='metric-item'>
          <Text className='metric-label'>内容</Text>
          <Text className='metric-value'>{aggregated?.contentCount ?? 0}</Text>
        </View>
        <View className='metric-item'>
          <Text className='metric-label'>学员</Text>
          <Text className='metric-value'>{aggregated?.studentCount ?? 0}</Text>
        </View>
        <View className='metric-item'>
          <Text className='metric-label'>评分</Text>
          <Text className='metric-value metric-value-rating'>
            {aggregated?.averageRating?.toFixed(1) ?? '0.0'}
          </Text>
        </View>
      </View>

      {specialties.length > 0 && (
        <View className='tags-row'>
          {specialties.slice(0, 4).map((s, i) => (
            <View key={i} className='tag-item'>
              <Text className='tag-text'>{s}</Text>
            </View>
          ))}
        </View>
      )}

      {coach?.bio ? (
        <Text className='coach-bio'>{coach.bio}</Text>
      ) : null}

      <View className='actions-row'>
        <View className='btn-consult' onClick={() => onConsult(subscription.coach_id)}>
          <Text><Message /></Text>
        </View>
        <View className='btn-detail' onClick={() => onDetail(subscription.coach_id)}>
          <Text>查看详情</Text>
          <Text>→</Text>
        </View>
      </View>

      {!WECHAT_COACH_PURCHASE_PAUSED && isExpiring && daysLeft !== null && (
        <View className='expiring-tip'>
          <Text className='expiring-tip-text'>即将于 {daysLeft} 天后到期，续费可继续享受专业指导。</Text>
          <Text className='expiring-tip-link' onClick={() => onRenew(subscription.coach_id)}>立即续费</Text>
        </View>
      )}
    </View>
  )
}
