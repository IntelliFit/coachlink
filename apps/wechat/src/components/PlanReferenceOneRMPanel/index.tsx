import { View, Text } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import './index.scss'

export interface PlanReferenceOneRMItem {
  id: string
  name: string
  value: number | null
  editable?: boolean
  badgeText?: string
}

interface PlanReferenceOneRMPanelProps {
  title: string
  caption?: string
  items: PlanReferenceOneRMItem[]
  expanded: boolean
  onToggle?: () => void
  onChange?: (id: string, value: string) => void
  onSave?: () => void
  saveLabel?: string
  emptyText?: string
}

export default function PlanReferenceOneRMPanel({
  title,
  caption,
  items,
  expanded,
  onToggle,
  onChange,
  onSave,
  saveLabel = '保存 1RM',
  emptyText = '当前没有需要配置 1RM 的动作'
}: PlanReferenceOneRMPanelProps) {
  const previewItems = items.slice(0, 3)

  return (
    <View className='plan-onerm'>
      <View className='plan-onerm__header'>
        <View>
          <Text className='plan-onerm__title'>{title}</Text>
          {caption ? <Text className='plan-onerm__caption'>{caption}</Text> : null}
        </View>
        {items.length > 0 && onToggle ? (
          <Text className='plan-onerm__toggle' onClick={onToggle}>
            {expanded ? '收起' : '展开'}
          </Text>
        ) : null}
      </View>

      {items.length === 0 ? (
        <Text className='plan-onerm__empty'>{emptyText}</Text>
      ) : (
        <>
          <View className='plan-onerm__summary'>
            {previewItems.map((item) => (
              <View key={`summary-${item.id}`} className={`plan-onerm__pill ${item.editable === false ? 'muted' : ''}`}>
                <Text className='plan-onerm__pill-name'>{item.name}</Text>
                <Text className='plan-onerm__pill-value'>{item.value !== null && item.value !== undefined ? `${item.value}kg` : '待填'}</Text>
              </View>
            ))}
            {items.length > 3 ? (
              <View className='plan-onerm__pill muted'>
                <Text className='plan-onerm__pill-name'>更多</Text>
                <Text className='plan-onerm__pill-value'>+{items.length - 3}</Text>
              </View>
            ) : null}
          </View>

          {expanded ? (
            <View className='plan-onerm__grid'>
              {items.map((item) => (
                <View key={item.id} className='plan-onerm__field'>
                  <View className='plan-onerm__label-row'>
                    <Text className='plan-onerm__label'>{item.name}</Text>
                    {item.badgeText ? <Text className='plan-onerm__badge'>{item.badgeText}</Text> : null}
                  </View>
                  <View className={`plan-onerm__input-wrap ${item.editable === false ? 'disabled' : ''}`}>
                    <Input
                      className='plan-onerm__input'
                      type='digit'
                      placeholder='1RM'
                      disabled={item.editable === false || !onChange}
                      value={item.value !== null && item.value !== undefined ? String(item.value) : ''}
                      onInput={(event) => onChange?.(item.id, event.detail.value)}
                    />
                    <Text className='plan-onerm__unit'>kg</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {expanded && onSave ? (
            <View className='plan-onerm__save' onClick={onSave}>
              <Text>{saveLabel}</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}
