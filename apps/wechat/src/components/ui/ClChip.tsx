import React, { type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import './ClChip.scss'

interface ClChipProps {
  children: string
  selected?: boolean
  className?: string
  onClick?: () => void
}

/** Filter chip. Selected state uses ink, never clay (clay means "do", ink means "chosen"). */
export function ClChip({ children, selected = false, className = '', onClick }: ClChipProps): React.ReactElement {
  return (
    <View
      className={`cl-chip ${selected ? 'cl-chip--selected' : ''} ${className}`.trim()}
      hoverClass='cl-chip--pressed'
      hoverStayTime={60}
      ariaRole='button'
      ariaLabel={selected ? `${children}，已选` : children}
      onClick={onClick}
    >
      <Text className='cl-chip__label'>{children}</Text>
    </View>
  )
}

export type ClTagTone = 'neutral' | 'clay' | 'warn' | 'done' | 'outline' | 'solid'

interface ClTagProps {
  children: ReactNode
  tone?: ClTagTone
  className?: string
}

/** Small static label: level (专业/进阶), status (新入驻/新纪录), plan tags. */
export function ClTag({ children, tone = 'neutral', className = '' }: ClTagProps): React.ReactElement {
  return (
    <View className={`cl-tag cl-tag--${tone} ${className}`.trim()}>
      <Text className='cl-tag__label'>{children}</Text>
    </View>
  )
}
