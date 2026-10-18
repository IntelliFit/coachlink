import React from 'react'
import { View, Text } from '@tarojs/components'
import './ClTabs.scss'

export interface ClTabItem<K extends string> {
  key: K
  label: string
  count?: number | string
}

interface ClTabsProps<K extends string> {
  items: Array<ClTabItem<K>>
  activeKey: K
  onChange: (key: K) => void
  className?: string
}

/** Underline tabs switched by tapping (never by a hidden swipe). */
export function ClTabs<K extends string>({ items, activeKey, onChange, className = '' }: ClTabsProps<K>): React.ReactElement {
  return (
    <View className={`cl-tabs ${className}`.trim()} ariaRole='tablist'>
      {items.map((item) => {
        const active = item.key === activeKey
        return (
          <View
            key={item.key}
            className={`cl-tabs__item ${active ? 'cl-tabs__item--active' : ''}`}
            ariaRole='tab'
            ariaLabel={active ? `${item.label}，当前` : item.label}
            onClick={() => {
              if (!active) onChange(item.key)
            }}
          >
            <Text className='cl-tabs__label'>{item.label}</Text>
            {item.count !== undefined && item.count !== '' ? (
              <Text className='cl-tabs__count cl-num'>{item.count}</Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
