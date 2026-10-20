import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { ClButton, ClTag } from '@/components/ui'
import { resolveWeappImageThumbnailUrl } from '@/utils/mediaUrl'

export interface PickerDetailAction {
  name: string
  detail?: string | null
  positions?: string[] | null
  url?: string | null
  reference_image_url?: string | null
}

interface PickerDetailSheetProps {
  action: PickerDetailAction
  selected: boolean
  busy?: boolean
  single?: boolean
  onToggle: () => void
  onOpenDemo: () => void
  onClose: () => void
}

/** Bottom sheet with the action illustration and coaching points, so users can check before adding. */
export function PickerDetailSheet({ action, selected, busy, single, onToggle, onOpenDemo, onClose }: PickerDetailSheetProps): React.ReactElement {
  const image = action.reference_image_url || ''
  const positions = Array.isArray(action.positions) ? action.positions.filter(Boolean) : []
  const detail = (action.detail || '').trim()
  const primaryLabel = single ? '选择这个动作' : selected ? '已加入，点击移除' : '加入本次训练'

  return (
    <View className='al-sheet'>
      <View className='al-sheet__mask' onClick={onClose} />
      <View className='al-sheet__panel'>
        <View className='al-sheet__head'>
          <Text className='al-sheet__title'>{action.name}</Text>
          <View className='al-sheet__close' onClick={onClose} ariaRole='button' ariaLabel='关闭'><Text>×</Text></View>
        </View>
        <ScrollView scrollY className='al-sheet__body'>
          {image ? (
            <Image
              className='al-sheet__image'
              src={resolveWeappImageThumbnailUrl(image, 960)}
              mode='aspectFit'
              onClick={() => Taro.previewImage({ urls: [image], current: image })}
            />
          ) : null}
          {positions.length > 0 ? (
            <View className='al-sheet__tags'>
              {positions.map((position) => <ClTag key={position}>{position}</ClTag>)}
            </View>
          ) : null}
          <Text className='al-sheet__label'>动作要点</Text>
          <Text className='al-sheet__text'>{detail || '这个动作还没有写要点，可以先看示意图。'}</Text>
        </ScrollView>
        <View className='al-sheet__actions'>
          {action.url ? (
            <ClButton variant='secondary' className='al-sheet__demo' onClick={onOpenDemo}>看演示</ClButton>
          ) : null}
          <ClButton
            variant={selected && !single ? 'secondary' : 'primary'}
            className='al-sheet__primary'
            loading={busy}
            loadingText='处理中'
            onClick={onToggle}
          >
            {primaryLabel}
          </ClButton>
        </View>
      </View>
    </View>
  )
}
