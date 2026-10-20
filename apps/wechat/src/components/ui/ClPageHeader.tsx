import React, { useMemo, type ReactNode } from 'react'
import { View, Text } from '@tarojs/components'
import { getCapsuleLayout } from '@/utils/capsuleLayout'
import './ClPageHeader.scss'

interface ClPageHeaderProps {
  title?: string
  /** Small line (e.g. the date) on the capsule row; the title then moves to its own line below. */
  kicker?: string
  /** Action on the title line, e.g. a theme toggle. Kept clear of the capsule. */
  right?: ReactNode
  /** Content under the title, e.g. a search bar or filter chips. */
  children?: ReactNode
  /** Set false on pages that keep the native navigation bar (no capsule offset needed). */
  customNav?: boolean
}

/**
 * The one header pattern for top-level pages: large title (plus optional kicker) aligned
 * with WeChat's capsule, then optional search or filters. Replaces the per-page headers.
 */
export function ClPageHeader({ title, kicker, right, children, customNav = true }: ClPageHeaderProps): React.ReactElement {
  const capsule = useMemo(() => getCapsuleLayout(), [])
  const capsuleRowStyle = customNav
    ? { paddingTop: `${capsule.top}px`, minHeight: `${capsule.height}px`, paddingRight: `${capsule.rightReserve}px` }
    : undefined
  const titleOnCapsuleRow = !kicker

  return (
    <View className='cl-page-header'>
      <View className='cl-page-header__capsule-row' style={capsuleRowStyle}>
        {kicker ? <Text className='cl-page-header__kicker'>{kicker}</Text> : null}
        {titleOnCapsuleRow && title ? <Text className='cl-page-header__title'>{title}</Text> : null}
        {titleOnCapsuleRow && right ? <View className='cl-page-header__right'>{right}</View> : null}
      </View>
      {!titleOnCapsuleRow && (title || right) ? (
        <View className='cl-page-header__title-row'>
          {title ? <Text className='cl-page-header__title'>{title}</Text> : null}
          {right ? <View className='cl-page-header__right'>{right}</View> : null}
        </View>
      ) : null}
      {children ? <View className='cl-page-header__extra'>{children}</View> : null}
    </View>
  )
}

interface ClSectionHeaderProps {
  title: string
  meta?: string
  actionText?: string
  onAction?: () => void
}

/** Section title with an optional count/meta and a "查看全部"-style text action. */
export function ClSectionHeader({ title, meta, actionText, onAction }: ClSectionHeaderProps): React.ReactElement {
  return (
    <View className='cl-section-header'>
      <View className='cl-section-header__main'>
        <Text className='cl-section-header__title'>{title}</Text>
        {meta ? <Text className='cl-section-header__meta cl-num'>{meta}</Text> : null}
      </View>
      {actionText ? (
        <Text className='cl-section-header__action' onClick={onAction}>
          {actionText} ›
        </Text>
      ) : null}
    </View>
  )
}
