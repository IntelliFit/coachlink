import { useMemo } from 'react'
import { View, PickerView, PickerViewColumn } from '@tarojs/components'

interface WheelPickerProps {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
  indicatorStyle?: string
}

const DEFAULT_ITEM_STYLE = 'height: 80rpx; line-height: 80rpx; text-align: center; font-size: 36rpx; color: #1e293b; font-weight: 600;'

const WheelPicker: React.FC<WheelPickerProps> = ({
  items,
  selectedIndex,
  onChange,
  indicatorStyle
}) => {
  const value = useMemo(() => [selectedIndex], [selectedIndex])

  return (
    <View style='width: 100%; height: 100%;'>
      <PickerView
        style='width: 100%; height: 480rpx;'
        value={value}
        indicatorStyle={indicatorStyle || 'height: 80rpx;'}
        onChange={(e) => {
          const idx = e.detail.value?.[0] ?? 0
          if (idx >= 0 && idx < items.length) {
            onChange(idx)
          }
        }}
      >
        <PickerViewColumn>
          {items.map((item, i) => (
            <View key={i} style={DEFAULT_ITEM_STYLE}>
              {item}
            </View>
          ))}
        </PickerViewColumn>
      </PickerView>
    </View>
  )
}

export default WheelPicker
