import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { IconFont } from '../components/IconFont'
import { colors, radius, spacing } from '../theme'

const iconByRoute: Record<string, string> = {
  TrainingTab: 'icon-dumbbell',
  CoachesTab: 'icon-discovery',
  KnowledgeTab: 'icon-knowledge',
  ToolboxTab: 'icon-toolbox',
  ProfileTab: 'icon-user',
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const options = descriptors[route.key]?.options
          const label = typeof options?.title === 'string' ? options.title : route.name
          const iconName = iconByRoute[route.name] || 'icon-circle'

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never)
            }
          }

          return (
            <Pressable key={route.key} accessibilityRole="button" accessibilityState={isFocused ? { selected: true } : {}} onPress={onPress} style={({ pressed }) => [styles.item, isFocused && styles.itemActive, pressed && styles.itemPressed]}>
              <IconFont name={iconName as any} size={20} color={isFocused ? colors.brand : 'rgba(255,255,255,0.66)'} />
              <Text numberOfLines={1} style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  bar: {
    width: '92%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(31,31,31,0.80)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  item: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
  },
  itemActive: {
    backgroundColor: 'rgba(255,255,255,0.98)',
  },
  itemPressed: {
    opacity: 0.78,
  },
  label: {
    maxWidth: 54,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '500',
  },
  labelActive: {
    color: '#111827',
    fontWeight: '700',
  },
})
