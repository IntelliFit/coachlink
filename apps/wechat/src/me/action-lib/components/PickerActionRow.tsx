import React from 'react'
import { View, Text, Image } from '@tarojs/components'

interface PickerActionRowProps {
  name: string
  meta: string
  imageUrl?: string | null
  selected: boolean
  busy?: boolean
  /** Plan selection picks one action and leaves; impromptu selection toggles. */
  single?: boolean
  onOpen: () => void
  onToggle: () => void
}

/** One action in the picker: tap the row for details, tap the round button to add / remove. */
export function PickerActionRow({ name, meta, imageUrl, selected, busy, single, onOpen, onToggle }: PickerActionRowProps): React.ReactElement {
  const label = selected ? `取消选择 ${name}` : `选择 ${name}`
  return (
    <View className={`al-row ${selected ? 'al-row--selected' : ''}`}>
      <View className='al-row__main' hoverClass='al-row__main--pressed' hoverStayTime={60} onClick={onOpen} ariaRole='button' ariaLabel={`查看 ${name} 的示意图和要点`}>
        {imageUrl ? (
          <Image className='al-row__thumb' src={imageUrl} mode='aspectFit' lazyLoad />
        ) : (
          <View className='al-row__thumb al-row__thumb--empty'><Text>{(name || '动').trim().slice(0, 1)}</Text></View>
        )}
        <View className='al-row__copy'>
          <Text className='al-row__name'>{name}</Text>
          {meta ? <Text className='al-row__meta'>{meta}</Text> : null}
        </View>
      </View>
      <View
        className={`al-row__toggle ${selected ? 'al-row__toggle--on' : ''} ${busy ? 'al-row__toggle--busy' : ''}`}
        hoverClass='al-row__toggle--pressed'
        hoverStayTime={60}
        ariaRole='button'
        ariaLabel={label}
        onClick={() => {
          if (!busy) onToggle()
        }}
      >
        <Text className='al-row__toggle-icon'>{busy ? '…' : selected ? '✓' : single ? '›' : '+'}</Text>
      </View>
    </View>
  )
}
