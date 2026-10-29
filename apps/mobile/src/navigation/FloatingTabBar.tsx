import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconFont } from '../components/IconFont'
import { useMessageCenter } from '../providers/MessageCenterProvider'
import { colors, controlHeight, radius, typography } from '../theme'

const studentIconByRoute: Record<string, string> = {
  TrainingTab: 'icon-dumbbell',
  CoachesTab: 'icon-friends-o',
  KnowledgeTab: 'icon-knowledge',
  ToolboxTab: 'icon-toolbox',
  ProfileTab: 'icon-user',
}

const coachIconByRoute: Record<string, string> = {
  CoachOverviewTab: 'icon-dashboard',
  CoachVideosTab: 'icon-video',
  CoachStudentsTab: 'icon-friends-o',
  CoachPlanTemplatesTab: 'icon-a-Trainingplan',
  CoachProfileTab: 'icon-account-settings-variant',
}

function isCoachTab(name: string) {
  return Object.prototype.hasOwnProperty.call(coachIconByRoute, name)
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { totalUnreadCount: unreadCount } = useMessageCenter()
  const insets = useSafeAreaInsets()
  // 与小程序 2026-10 改版的底部导航一致：白色贴底栏、上边线、图标在上文字在下、当前页陶土色。
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index
        const options = descriptors[route.key]?.options
        const label = typeof options?.title === 'string' ? options.title : route.name
        const iconMap = isCoachTab(route.name) ? coachIconByRoute : studentIconByRoute
        const iconName = iconMap[route.name] || 'icon-circle'
        const showsUnread = route.name === 'ProfileTab' || route.name === 'CoachProfileTab'
        const accessibilityLabel = showsUnread && unreadCount > 0 ? `${label}，${unreadCount} 条未读` : label

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name as never)
          }
        }

        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected: isFocused }} onPress={onPress} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
            <View>
              <IconFont name={iconName as any} size={24} color={isFocused ? colors.brand : colors.textTertiary} />
              {showsUnread && unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: controlHeight.tabBar,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    minWidth: 0,
    height: controlHeight.tabBar,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  itemPressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.textTertiary,
    fontSize: typography.tag.fontSize,
    lineHeight: typography.tag.lineHeight,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.link,
    fontWeight: '700',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -12,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  unreadBadgeText: {
    color: colors.surface,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
})
