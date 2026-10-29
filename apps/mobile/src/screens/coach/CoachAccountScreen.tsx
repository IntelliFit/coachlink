import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { InlineAvatar, Card, MenuRow, ScreenShell, SolidButton } from '../me/MeShared'
import { useAuth } from '../../providers/AuthProvider'
import { useMessageCenter } from '../../providers/MessageCenterProvider'
import { colors, radius, spacing } from '../../theme'
import type { MainTabParamList, RootStackParamList } from '../../navigation/types'

type Props = BottomTabScreenProps<MainTabParamList, 'CoachProfileTab'>

export function CoachAccountScreen({ navigation }: Props) {
  const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()
  const { user, switchRole } = useAuth()
  const { unreadCount, announcementUnreadCount } = useMessageCenter()
  const [switching, setSwitching] = useState(false)
  const displayName = String(user?.nickname || user?.name || user?.phone || user?.email || 'CoachLink 教练')
  const contact = String(user?.phone || user?.email || '教练账号')

  async function switchToStudent() {
    try {
      setSwitching(true)
      await switchRole('student')
      rootNavigation?.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
    } catch (error) {
      Alert.alert('切换失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSwitching(false)
    }
  }

  function confirmSwitchToStudent() {
    Alert.alert('切换到学员端', '切换后会回到学员训练首页，教练资料和业务数据不会受到影响。', [
      { text: '取消', style: 'cancel' },
      { text: '确认切换', onPress: () => void switchToStudent() },
    ])
  }

  return (
    <ScreenShell title="我的" subtitle="教练身份、经营数据和账户设置。" tabBarInset>
      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          <InlineAvatar uri={user?.avatar_url || user?.avatar} label={displayName} size={72} />
          <View style={styles.profileMain}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileContact}>{contact}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>当前：教练端</Text>
            </View>
          </View>
        </View>
        <Text style={styles.roleHint}>教练端用于管理学员、计划、视频和收入；需要记录自己的训练时可随时切回学员端。</Text>
        <SolidButton label="切换到学员端" variant="secondary" loading={switching} onPress={confirmSwitchToStudent} />
      </Card>

      <Card>
        <MenuRow label="消息中心" desc="联系学员并查看未读消息" icon="icon-messages" iconBg="#26A69A" badge={unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined} onPress={() => rootNavigation?.navigate('Messages')} />
        <MenuRow label="平台通知" desc="版本更新、活动和服务公告" icon="icon-pinglun" iconBg="#FFA940" badge={announcementUnreadCount > 0 ? (announcementUnreadCount > 99 ? '99+' : String(announcementUnreadCount)) : undefined} onPress={() => rootNavigation?.navigate('Announcements')} />
        <MenuRow label="教练工作台" desc="业务概览与待处理事项" icon="icon-dashboard" iconBg="#CF6D4E" onPress={() => rootNavigation?.navigate('CoachDashboard')} />
        <MenuRow label="学员管理" desc="学员、计划和训练进展" icon="icon-friends-o" iconBg="#5C8DFF" onPress={() => rootNavigation?.navigate('CoachStudents')} />
        <MenuRow label="教练钱包" desc="余额、结算、开户与提现" icon="icon-goumaijilu" iconBg="#29C3A3" onPress={() => rootNavigation?.navigate('CoachWallet')} />
        <MenuRow label="收入分析" desc="收入趋势与来源" icon="icon-ranking" iconBg="#FFA940" onPress={() => rootNavigation?.navigate('CoachRevenue')} />
      </Card>

      <Card>
        <MenuRow label="服务定价" desc="套餐与购买周期" icon="icon-vips" iconBg="#CF6D4E" onPress={() => rootNavigation?.navigate('CoachPricing')} />
        <MenuRow label="内容管理" desc="教练专栏与付费内容" icon="icon-knowledge" iconBg="#722ED1" onPress={() => rootNavigation?.navigate('CoachContents')} />
        <MenuRow label="问卷管理" desc="入组问卷与训练评估" icon="icon-jhk" iconBg="#5C8DFF" onPress={() => rootNavigation?.navigate('CoachQuestionnaires')} />
        <MenuRow label="账户设置" desc="身份切换、缓存、协议和安全" icon="icon-account-settings-variant" iconBg="#6B7280" onPress={() => rootNavigation?.navigate('Settings')} />
      </Card>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  profileCard: {
    gap: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileMain: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  profileName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  profileContact: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.brandSoft,
  },
  roleBadgeText: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '700',
  },
  roleHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
})
