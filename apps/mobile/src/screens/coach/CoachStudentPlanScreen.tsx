import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useNavigation, usePreventRemove, useRoute, type RouteProp } from '@react-navigation/native'
import { getLockedThroughDayIndex, mergeLockedPlanDays } from '@coachlink/core/src/planEditLock'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { Card, EmptyState, LoadingState, ScreenShell, SolidButton, errorMessage, safeRequest, type RootNav } from '../me/MeShared'
import { PlanDaysEditor } from '../plan/PlanDaysEditor'
import { normalizePlanDays } from '../plan/model/planEditor'
import { finalizeDays, findUnpickedStrength, prepareDaysForEditor } from '../plan/model/planDayOps'
import { ensureSetUids } from '../plan/model/planSetFields'
import type { PlanActionOption, PlanTrainingDay } from '../plan/model/planTypes'

/** 与小程序一致：只有进行中或已暂停的计划可以编辑。 */
function isEditableStatus(status?: string | null) {
  const value = String(status || '').toLowerCase()
  return value === 'active' || value === 'paused'
}

function executionsOf(planRes: any) {
  return Array.isArray(planRes?.executions) ? planRes.executions : Object.values(planRes?.executionsByDayIndex || {})
}

function statusLabel(status?: string | null) {
  const value = String(status || '').toLowerCase()
  if (value === 'paused') return '已暂停'
  if (value === 'completed') return '已完成'
  return '进行中'
}

/**
 * 教练编辑学员当前计划，对应小程序 coach/students/plan 的核心能力：
 * 按天改动作/组数/强度、暂停与恢复。已有训练记录的天只读（与服务端 update-instance 的锁定规则一致）。
 */
export function CoachStudentPlanScreen() {
  const navigation = useNavigation<RootNav>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachStudentPlan'>>()
  const subscriptionId = route.params?.subscriptionId || ''
  const [instance, setInstance] = useState<any>(null)
  const [days, setDays] = useState<PlanTrainingDay[]>([])
  const [lockedThrough, setLockedThrough] = useState(0)
  const [actions, setActions] = useState<PlanActionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')
  // 用 state 驱动 usePreventRemove（iOS 侧滑需要提前注册）；ref 给异步回调读最新值。
  const [dirty, setDirtyState] = useState(false)
  const dirtyRef = useRef(false)
  const setDirty = (value: boolean) => {
    dirtyRef.current = value
    setDirtyState(value)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [planRes, actionRes] = await Promise.all([
        safeRequest<any>('/api/plan-lib/get-instance', { body: { subscriptionId } }),
        safeRequest<any>('/api/action-lib/list-actions', { body: { page: 1, limit: 500 } }).catch(() => null),
      ])
      const nextInstance = planRes?.instance || null
      setInstance(nextInstance)
      setDays(nextInstance ? prepareDaysForEditor(nextInstance.training_days) : [])
      setLockedThrough(getLockedThroughDayIndex(executionsOf(planRes) as any[]))
      setActions(Array.isArray(actionRes?.actions) ? actionRes.actions : [])
      setDirty(false)
    } catch (loadError) {
      setError(errorMessage(loadError, '计划加载失败'))
    } finally {
      setLoading(false)
    }
  }, [subscriptionId])

  useEffect(() => {
    void load()
  }, [load])

  // 侧滑返回、Android 返回键、页面内返回都拦截未保存的修改。
  usePreventRemove(dirty, ({ data }) => {
    Alert.alert('放弃修改？', '计划还有未保存的修改。', [
      { text: '继续编辑', style: 'cancel' },
      {
        text: '放弃',
        style: 'destructive',
        onPress: () => {
          setDirty(false)
          navigation.dispatch(data.action)
        },
      },
    ])
  })

  const goBack = () => navigation.goBack()

  /**
   * 保存被拒（多半是学员刚练了某天，锁定范围变大）：重新读取服务端计划，
   * 新锁定的天恢复成服务端内容，其余天保留教练的修改，提示后让教练再保存。
   */
  async function recoverFromRejectedSave(message: string) {
    try {
      const planRes = await safeRequest<any>('/api/plan-lib/get-instance', { body: { subscriptionId } })
      if (String(planRes?.instance?.id || '') !== String(instance?.id || '')) {
        // 学员的当前计划已被替换（例如别处重新分配），不能把修改合到另一份计划上。
        Alert.alert('计划已变化', '学员的当前计划已被替换，请返回后重新打开。')
        return
      }
      const serverDays = normalizePlanDays(planRes?.instance?.training_days)
      const nextLocked = getLockedThroughDayIndex(executionsOf(planRes) as any[])
      if (nextLocked <= lockedThrough) {
        Alert.alert('保存失败', message)
        return
      }
      const merged = mergeLockedPlanDays({ savedDays: serverDays, nextDays: days, lockedThroughDayIndex: nextLocked })
      setDays(ensureSetUids(merged.days))
      setLockedThrough(nextLocked)
      Alert.alert(
        '学员刚完成了训练',
        merged.restoredDayIndexes.length > 0
          ? `第 ${merged.restoredDayIndexes.join('、')} 天已有训练记录，已恢复为原安排；其他修改保留，请检查后再保存。`
          : `前 ${nextLocked} 天已有训练记录，现在只能改参数；你的修改都保留了，请再保存一次。`,
      )
    } catch {
      Alert.alert('保存失败', message)
    }
  }

  async function save() {
    if (!instance?.id) return
    const unpicked = findUnpickedStrength(days)
    if (unpicked) {
      Alert.alert('还有动作未选择', `第 ${unpicked.dayIndex} 天的第 ${unpicked.setIndex + 1} 个力量项还没选动作。`)
      return
    }
    setSaving(true)
    try {
      await safeRequest('/api/plan-lib/update-instance', { body: { id: instance.id, trainingDays: finalizeDays(days, lockedThrough) } })
      setDirty(false)
      Alert.alert('已保存', '学员今日训练会同步新的安排。')
      await load()
    } catch (saveError) {
      await recoverFromRejectedSave(errorMessage(saveError, '请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  async function togglePause() {
    if (!instance?.id) return
    if (dirtyRef.current) {
      Alert.alert('请先保存修改', '计划还有未保存的修改，保存后再暂停或恢复。')
      return
    }
    const paused = String(instance.status || '').toLowerCase() === 'paused'
    const run = async () => {
      setToggling(true)
      try {
        const nextStatus = paused ? 'active' : 'paused'
        await safeRequest('/api/plan-lib/update-instance', { body: { id: instance.id, status: nextStatus } })
        setInstance((current: any) => (current ? { ...current, status: nextStatus } : current))
      } catch (toggleError) {
        Alert.alert(paused ? '恢复失败' : '暂停失败', errorMessage(toggleError))
      } finally {
        setToggling(false)
      }
    }
    Alert.alert(paused ? '恢复计划' : '暂停计划', paused ? '恢复后学员可以继续按计划训练。' : '暂停后学员今日训练不再推进这份计划，可随时恢复。', [
      { text: '取消', style: 'cancel' },
      { text: paused ? '恢复' : '暂停', onPress: () => void run() },
    ])
  }

  return (
    <ScreenShell title="编辑学员计划" subtitle={route.params?.studentName ? `${route.params.studentName} 的当前计划` : '学员当前计划'} onBack={goBack}>
      {loading ? <LoadingState title="正在加载计划" /> : null}
      {!loading && error ? (
        <>
          <EmptyState title="加载失败" desc={error} />
          <SolidButton label="重试" variant="secondary" onPress={() => void load()} />
        </>
      ) : null}
      {!loading && !error && !instance ? <EmptyState title="学员还没有计划" desc="先在学员档案里分配一份计划。" icon="icon-a-Trainingplan" /> : null}
      {!loading && !error && instance ? (
        <>
          <Card style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.planName} numberOfLines={2}>{instance.name || '未命名计划'}</Text>
              <Text style={[styles.status, String(instance.status).toLowerCase() === 'paused' && styles.statusPaused]}>{statusLabel(instance.status)}</Text>
            </View>
            <Text style={styles.meta}>
              {days.length} 天安排
              {!isEditableStatus(instance.status) ? ' · 这份计划已结束，只能查看' : lockedThrough > 0 ? ` · 前 ${lockedThrough} 天已有训练记录，只能改组数、次数、重量和备注` : ''}
            </Text>
            {isEditableStatus(instance.status) ? (
              <SolidButton label={String(instance.status).toLowerCase() === 'paused' ? '恢复计划' : '暂停计划'} variant="secondary" loading={toggling} onPress={() => void togglePause()} />
            ) : null}
          </Card>
          <Card>
            <PlanDaysEditor
              days={days}
              onChange={(next) => {
                setDirty(true)
                setDays(next)
              }}
              actions={actions}
              mode="coach"
              lockedThroughDayIndex={lockedThrough}
              initialDayIndex={route.params?.focusDay}
              // 保存请求进行中只读：保存和失败恢复用的是按下保存时的数据，期间的修改会被覆盖。
              readOnly={!isEditableStatus(instance.status) || saving}
            />
          </Card>
          {isEditableStatus(instance.status) ? <SolidButton label="保存计划" loading={saving} onPress={() => void save()} /> : null}
        </>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  planName: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  status: {
    color: colors.success,
    backgroundColor: '#ECF7EF',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  statusPaused: {
    color: colors.warning,
    backgroundColor: '#FFF7E6',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
})
