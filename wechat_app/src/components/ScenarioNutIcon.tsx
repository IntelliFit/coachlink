import { View } from '@tarojs/components'
import { User, Location, Target, Heart } from '@nutui/icons-react-taro'
import type { ScenarioQuickFixIcon } from '@/constants/scenarioQuickFixes'

const MAP: Record<ScenarioQuickFixIcon, typeof User> = {
  User,
  Location,
  Target,
  Heart
}

export function ScenarioNutIcon({
  name,
  size = 20,
  color = '#CF6D4E'
}: {
  name: ScenarioQuickFixIcon
  size?: number
  color?: string
}) {
  const Cmp = MAP[name] || Target
  return (
    <View className='scenario-nut-icon'>
      <Cmp size={size} color={color} />
    </View>
  )
}
