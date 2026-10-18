import React, { type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import './ClListRow.scss'

interface ClListRowProps {
  label: string
  value?: string
  icon?: ReactNode
  /** Unread count or short marker shown as a clay dot badge. */
  badge?: number | string
  showArrow?: boolean
  danger?: boolean
  onClick?: () => void
}

/** 52px settings-style row; stack them inside a ClCard with padding="none". */
export function ClListRow({
  label,
  value,
  icon,
  badge,
  showArrow = true,
  danger = false,
  onClick
}: ClListRowProps): React.ReactElement {
  const hasBadge = badge !== undefined && badge !== null && badge !== '' && badge !== 0
  return (
    <View
      className='cl-row'
      hoverClass={onClick ? 'cl-row--pressed' : 'none'}
      hoverStayTime={60}
      ariaRole={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      {icon ? <View className='cl-row__icon'>{icon}</View> : null}
      <Text className={`cl-row__label ${danger ? 'cl-row__label--danger' : ''}`}>{label}</Text>
      {hasBadge ? <Text className='cl-row__badge cl-num'>{badge}</Text> : null}
      {value ? <Text className='cl-row__value'>{value}</Text> : null}
      {showArrow ? <Text className='cl-row__arrow'>›</Text> : null}
    </View>
  )
}
