import React, { useMemo, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import { ArrowUp, Check, Heart, More } from '@nutui/icons-react-taro'
import './LightweightActionPicker.scss'

interface LightweightActionPickerProps {
  visible: boolean
  loading?: boolean
  actions: any[]
  onClose: () => void
  onSelect: (action: any) => void
}

function LightweightActionPicker({ visible, loading = false, actions, onClose, onSelect }: LightweightActionPickerProps) {
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase()
    if (!k) return actions
    return actions.filter((item) => String(item?.name || '').toLowerCase().includes(k))
  }, [actions, keyword])

  if (!visible) return null

  const resolveIcon = (type?: string) => {
    const normalizedType = String(type || '').toUpperCase()
    if (normalizedType === 'DIET') return <Heart size={16} />
    if (normalizedType === 'CARDIO') return <ArrowUp size={16} />
    if (normalizedType === 'HABIT') return <Check size={16} />
    return <More size={16} />
  }

  return (
    <View className='lightweight-picker-mask' onClick={onClose}>
      <View className='lightweight-picker-panel' onClick={(e) => e.stopPropagation()}>
        <Text className='picker-title'>选择轻任务动作</Text>
        <Input
          className='picker-search-input'
          value={keyword}
          placeholder='搜索动作'
          onInput={(e) => setKeyword(e.detail.value)}
        />
        <ScrollView scrollY className='picker-list'>
          {loading && <Text className='picker-empty'>加载中...</Text>}
          {!loading && filtered.map((item) => (
            <View key={item.id} className='picker-item' onClick={() => onSelect(item)}>
              <View className={`picker-icon ${String(item.type || '').toLowerCase()}`}>
                {resolveIcon(item.type)}
              </View>
              <View className='picker-main'>
                <Text className='picker-name'>{item.name || '未命名'}</Text>
                <Text className='picker-detail'>{item.detail || '从动作库追加到当天安排中'}</Text>
              </View>
              <Text className='picker-type'>{item.type || 'STRENGTH'}</Text>
            </View>
          ))}
          {!loading && filtered.length === 0 && (
            <Text className='picker-empty'>暂无匹配动作</Text>
          )}
        </ScrollView>
        <View className='picker-cancel' onClick={onClose}>
          <Text>取消</Text>
        </View>
      </View>
    </View>
  )
}

export default LightweightActionPicker
