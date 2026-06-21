import { useEffect, useMemo, useState } from 'react'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../api'
import { Page } from '../components/Page'
import { SectionCard } from '../components/SectionCard'
import { colors, spacing } from '../theme'
import { ActionGrid, ActionTile, HeroPanel, RowCard } from './AppHomeShared'
import type { MainTabParamList, RootStackParamList } from '../navigation/types'

type Props = BottomTabScreenProps<MainTabParamList, 'TrainingTab'>

function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

export function TrainingScreen({ navigation }: Props) {
  const rootNav = navigation.getParent<any>()
  const [loading, setLoading] = useState(true)
  const [todayPlan, setTodayPlan] = useState<any>(null)
  const [actions, setActions] = useState<any[]>([])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      try {
        const [todayRes, actionRes] = await Promise.allSettled([
          apiClient.request('/api/plan-lib/get-today-training-instance', { method: 'POST', body: {}, timeoutMs: 12000 }),
          apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 4 }, timeoutMs: 10000 }),
        ])
        if (!alive) return
        if (todayRes.status === 'fulfilled') {
          const data = (todayRes.value as any).data?.data || (todayRes.value as any).data || {}
          setTodayPlan(data.coachPlan || data.selfPlan || null)
        }
        if (actionRes.status === 'fulfilled') setActions(pickArray((actionRes.value as any).data, ['actions', 'items', 'data']).slice(0, 4))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [])

  const stats = useMemo(() => {
    const instance = todayPlan?.instance || todayPlan || {}
    return [
      { label: '当前计划', value: instance.name || instance.title || '未配置' },
      { label: '推荐天数', value: todayPlan?.recommendedDayIndex ?? todayPlan?.derived?.recommendedDayIndex ?? todayPlan?.nextDayIndex ?? '-' },
      { label: '训练日数', value: Array.isArray(instance.training_days) ? instance.training_days.length : '-' },
    ]
  }, [todayPlan])

  const go = (name: keyof RootStackParamList, params?: any) => rootNav?.navigate(name, params)
  const openTodayTraining = () => {
    const instance = todayPlan?.instance || todayPlan
    const instanceId = instance?.id
    const dayIndex = Number(todayPlan?.recommendedDayIndex ?? todayPlan?.derived?.recommendedDayIndex ?? todayPlan?.nextDayIndex ?? 1) || 1
    go('TrainingExecution', instanceId ? { instanceId, dayIndex } : undefined)
  }

  return (
    <Page>
      <HeroPanel title="训练" subtitle="今日计划、即兴锻炼、动作库和历史记录集中在这里。" kicker="CoachLink" icon="icon-dumbbell" />

      <View style={styles.stats}>
        {stats.map((item) => (
          <View key={item.label} style={styles.stat}>
            <Text style={styles.statValue}>{String(item.value)}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      <SectionCard title="今日训练" description="对应小程序首页 / training/today-training 的训练控制台。">
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        <RowCard title="查看今日训练" subtitle="进入当前计划训练日，读取本地快照并同步云端 execution。" icon="icon-a-Trainingplan" onPress={openTodayTraining} />
        <RowCard title="即兴锻炼" subtitle="没有计划也能从动作库快速开始记录。" icon="icon-strength" onPress={() => go('ImpromptuTraining')} />
      </SectionCard>

      <ActionGrid>
        <ActionTile title="动作库" subtitle="个人动作与公共动作" icon="icon-dumbbell" onPress={() => go('ActionLibrary')} />
        <ActionTile title="全部计划" subtitle="当前与历史计划" icon="icon-a-Trainingplan" onPress={() => go('PlanHistory')} />
        <ActionTile title="训练历史" subtitle="日历、记录、分享" icon="icon-training_history" onPress={() => go('TrainingHistory')} />
        <ActionTile title="力量曲线" subtitle="e1RM 趋势" icon="icon-ranking" onPress={() => go('E1RMChart')} />
      </ActionGrid>

      <SectionCard title="最近动作" description="从个人动作库读取，和小程序训练页的动作入口保持同源。">
        {actions.length === 0 ? (
          <Text style={styles.empty}>暂无动作，先去动作库添加或从公共库复制。</Text>
        ) : (
          actions.map((action) => (
            <RowCard key={String(action.id || action.name)} title={action.name || action.action_name || '未命名动作'} subtitle={action.category || action.muscle_group || action.equipment || '个人动作'} icon="icon-dumbbell" onPress={() => go('ActionDetail', { id: action.id, action, source: 'mine' })} />
          ))
        )}
      </SectionCard>
    </Page>
  )
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    minHeight: 80,
    justifyContent: 'center',
    borderRadius: 24,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
})
