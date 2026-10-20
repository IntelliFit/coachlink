import React, { type ReactNode } from 'react'
import { View } from '@tarojs/components'
import './ClCard.scss'

interface ClCardProps {
  children: ReactNode
  /** `none` for cards whose rows draw their own padding (lists, tables). */
  padding?: 'md' | 'sm' | 'none'
  className?: string
  onClick?: () => void
}

/** White card with a hairline border; the single card style shared by every page. */
export function ClCard({ children, padding = 'md', className = '', onClick }: ClCardProps): React.ReactElement {
  return (
    <View
      className={`cl-card cl-card--pad-${padding} ${className}`.trim()}
      hoverClass={onClick ? 'cl-card--pressed' : 'none'}
      hoverStayTime={60}
      onClick={onClick}
    >
      {children}
    </View>
  )
}
