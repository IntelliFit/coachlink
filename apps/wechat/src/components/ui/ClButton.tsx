import React, { type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import './ClButton.scss'

export type ClButtonVariant = 'primary' | 'secondary' | 'text'
export type ClButtonSize = 'lg' | 'md' | 'sm'

interface ClButtonProps {
  children: ReactNode
  variant?: ClButtonVariant
  size?: ClButtonSize
  block?: boolean
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  icon?: ReactNode
  className?: string
  onClick?: () => void
}

/** One primary (clay) button per screen; everything else is secondary (outlined) or text. */
export function ClButton({
  children,
  variant = 'primary',
  size = 'lg',
  block = false,
  disabled = false,
  loading = false,
  loadingText = '处理中…',
  icon,
  className = '',
  onClick
}: ClButtonProps): React.ReactElement {
  const inactive = disabled || loading
  const classes = [
    'cl-btn',
    `cl-btn--${variant}`,
    `cl-btn--${size}`,
    block ? 'cl-btn--block' : '',
    inactive ? 'cl-btn--disabled' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <View
      className={classes}
      hoverClass={inactive ? 'none' : 'cl-btn--pressed'}
      hoverStayTime={60}
      ariaRole='button'
      onClick={() => {
        if (!inactive) onClick?.()
      }}
    >
      {icon ? <View className='cl-btn__icon'>{icon}</View> : null}
      <Text className='cl-btn__label'>{loading ? loadingText : children}</Text>
    </View>
  )
}
