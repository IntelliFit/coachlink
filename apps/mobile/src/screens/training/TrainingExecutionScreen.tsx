import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../../api'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { IconFont } from '../../components/IconFont'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { executionSnapshotKey, persistExecutionSnapshot, readExecutionSnapshot } from './trainingCache'
import { displayLoad, normalizeExecution, parseNumberInput, pickData } from './trainingModel'

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingExecution'>
type DraftValue = { weight: string; reps: string; rpe: string }
type PickerAction = { id?: string; name: string; type?: string; source: 'mine' | 'public' }

function draftKey(actionIndex: number, setIndex: number) {
  return `${actionIndex}:${setIndex}`
}

export function TrainingExecutionScreen({ route, navigation }: Props) {
  const params = route.params || {}
  const isImpromptu = Boolean((params as any).impromptuId)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [execution, setExecution] = useState<any | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftValue>>({})
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerActions, setPickerActions] = useState<PickerAction[]>([])

  const cacheKey = useMemo(() => {
    if ((params as any).impromptuId) return executionSnapshotKey({ mode: 'impromptu', id: (params as any).impromptuId })
    return executionSnapshotKey({ mode: 'plan', instanceId: params.instanceId, dayIndex: params.dayIndex || 1 })
  }, [params])

  async function hydrateFromCloud() {
    if (!(params as any).impromptuId && !params.instanceId) {
      setLoading(false)
      return
    }
    setSyncing(true)
    try {
      const res = isImpromptu
        ? await apiClient.request('/api/impromptu/get', { method: 'POST', body: { id: (params as any).impromptuId }, timeoutMs: 15000 })
        : await apiClient.request('/api/execution/start', { method: 'POST', body: { instanceId: params.instanceId, dayIndex: params.dayIndex || 1 }, timeoutMs: 15000 })
      const normalized = normalizeExecution(pickData(res))
      setExecution(normalized)
      await persistExecutionSnapshot(cacheKey, normalized)
    } catch (error) {
      if (!execution) Alert.alert('加载失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  const progressText = execution ? `${execution.completed_sets || 0}/${execution.total_sets || 0}` : '-'
  const status = String(execution?.status || '').toLowerCase()
  const isCompleted = status === 'completed' || status === 'finished'

  useEffect(() => {
    let alive = true
    async function boot() {
      const cached = await readExecutionSnapshot(cacheKey)
      if (alive && cached) {
        setExecution(normalizeExecution(cached))
        setLoading(false)
      }
      if (alive) await hydrateFromCloud()
    }
    void boot()
    return () => {
      alive = false
    }
  }, [cacheKey])

  useEffect(() => {
    const startedAt = new Date(execution?.started_at || execution?.created_at || Date.now()).getTime()
    const tick = () => {
      const base = Number.isFinite(startedAt) ? startedAt : Date.now()
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - base) / 1000)))
    }
    tick()
    if (isCompleted) return
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [execution?.started_at, execution?.created_at, isCompleted])

  const elapsedText = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`

  function setDraft(actionIndex: number, setIndex: number, patch: Partial<DraftValue>) {
    const key = draftKey(actionIndex, setIndex)
    setDrafts((current) => {
      const base: DraftValue = current[key] || { weight: '', reps: '', rpe: '' }
      return { ...current, [key]: { ...base, ...patch } }
    })
  }

  function getDraft(actionIndex: number, setIndex: number, set: any): DraftValue {
    const existing = drafts[draftKey(actionIndex, setIndex)]
    if (existing) return existing
    return {
      weight: set.actualWeight != null ? String(set.actualWeight) : set.plannedWeight != null ? String(set.plannedWeight).replace(/[^\d.-]/g, '') : '',
      reps: set.actualReps != null ? String(set.actualReps) : set.plannedReps != null ? String(set.plannedReps).replace(/[^\d.-]/g, '') : '',
      rpe: set.rpe != null ? String(set.rpe) : '',
    }
  }

  async function completeSet(actionIndex: number, setIndex: number, set: any) {
    if (!execution?.id || syncing) return
    const draft = getDraft(actionIndex, setIndex, set)
    setSyncing(true)
    try {
      const body: any = {
        executionId: execution.id,
        actionIndex,
        setIndex,
        actualWeight: parseNumberInput(draft.weight),
        actualReps: parseNumberInput(draft.reps),
      }
      if (!isImpromptu) body.rpe = parseNumberInput(draft.rpe)
      const res = await apiClient.request(isImpromptu ? '/api/impromptu/complete-set' : '/api/execution/complete-set', { method: 'POST', body, timeoutMs: 15000 })
      const data = pickData(res)
      const next = Array.isArray(data?.action_executions)
        ? normalizeExecution(data)
        : patchCompletedSet(execution, actionIndex, setIndex, {
          actualWeight: body.actualWeight,
          actualReps: body.actualReps,
          rpe: body.rpe,
          completedSets: data?.completedSets,
          totalSets: data?.totalSets,
        })
      setExecution(next)
      await persistExecutionSnapshot(cacheKey, next)
    } catch (error) {
      Alert.alert('记录失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  function patchCompletedSet(current: any, actionIndex: number, setIndex: number, values: { actualWeight: number | null; actualReps: number | null; rpe?: number | null; completedSets?: number; totalSets?: number }) {
    const nextActions = current.action_executions.map((action: any) => {
      if (action.actionIndex !== actionIndex) return action
      const nextSets = action.sets.map((item: any) => item.setIndex === setIndex
        ? { ...item, status: 'completed', actualWeight: values.actualWeight, actualReps: values.actualReps, rpe: values.rpe ?? item.rpe }
        : item)
      return { ...action, sets: nextSets }
    })
    return {
      ...current,
      action_executions: nextActions,
      completed_sets: Number(values.completedSets ?? nextActions.reduce((sum: number, action: any) => sum + action.sets.filter((item: any) => item.status === 'completed').length, 0)),
      total_sets: Number(values.totalSets ?? current.total_sets ?? nextActions.reduce((sum: number, action: any) => sum + action.sets.length, 0)),
    }
  }

  async function addSet(actionIndex: number, action: any) {
    if (!execution?.id || syncing) return
    const last = action.sets[action.sets.length - 1]
    setSyncing(true)
    try {
      await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/add-extra-set' : '/api/execution/extra-content/add-extra-set', {
        method: 'POST',
        body: {
          executionId: execution.id,
          actionIndex,
          weight: last?.actualWeight ?? last?.plannedWeight ?? null,
          reps: last?.actualReps ?? last?.plannedReps ?? null,
        },
        timeoutMs: 15000,
      })
      await hydrateFromCloud()
    } catch (error) {
      Alert.alert('加组失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  async function deleteSet(actionIndex: number, setIndex: number) {
    if (!execution?.id || syncing) return
    Alert.alert('删除这一组', '只允许删除训练中额外添加的组。确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSyncing(true)
            try {
              await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/delete-extra-set' : '/api/execution/extra-content/delete-extra-set', {
                method: 'POST',
                body: { executionId: execution.id, actionIndex, setIndex },
                timeoutMs: 15000,
              })
              await hydrateFromCloud()
            } catch (error) {
              Alert.alert('删除失败', error instanceof Error ? error.message : '只有额外添加的组可以删除')
            } finally {
              setSyncing(false)
            }
          })()
        },
      },
    ])
  }

  async function deleteExercise(actionIndex: number) {
    if (!execution?.id || syncing) return
    Alert.alert('删除动作', '只允许删除训练中额外添加的动作。确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSyncing(true)
            try {
              await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/delete-extra-exercise' : '/api/execution/extra-content/delete-extra-exercise', {
                method: 'POST',
                body: { executionId: execution.id, actionIndex },
                timeoutMs: 15000,
              })
              await hydrateFromCloud()
            } catch (error) {
              Alert.alert('删除失败', error instanceof Error ? error.message : '只有额外添加的动作可以删除')
            } finally {
              setSyncing(false)
            }
          })()
        },
      },
    ])
  }

  async function loadPickerActions(search = pickerQuery) {
    setPickerLoading(true)
    try {
      const [mineRes, publicRes] = await Promise.allSettled([
        apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 40, search }, timeoutMs: 10000 }),
        apiClient.request('/api/public-action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 40, search, status: 'published' }, timeoutMs: 10000 }),
      ])
      const mine = mineRes.status === 'fulfilled' ? pickActionRows((mineRes.value as any).data, 'mine') : []
      const seen = new Set(mine.map((item) => item.name))
      const pub = publicRes.status === 'fulfilled' ? pickActionRows((publicRes.value as any).data, 'public').filter((item) => !seen.has(item.name)) : []
      setPickerActions([...mine, ...pub])
    } finally {
      setPickerLoading(false)
    }
  }

  function openActionPicker() {
    setPickerVisible(true)
    void loadPickerActions('')
  }

  function pickActionRows(payload: any, source: 'mine' | 'public'): PickerAction[] {
    const data = pickData(payload)
    const rows = ['actions', 'items', 'data'].flatMap((key) => Array.isArray(data?.[key]) ? data[key] : [])
    return rows.map((row: any) => ({
      id: row.id,
      name: String(row.name || row.action_name || '').trim(),
      type: row.type || row.category || row.muscle_group,
      source,
    })).filter((row) => row.name)
  }

  async function ensureStudentAction(row: PickerAction): Promise<PickerAction> {
    if (row.source === 'mine') return row
    try {
      const res = await apiClient.request('/api/public-action-lib/add-to-my-lib', {
        method: 'POST',
        body: { actionId: row.id, targetActionType: 'student' },
        timeoutMs: 15000,
      })
      const action = pickData(res)?.action
      if (action?.id) return { id: action.id, name: action.name || row.name, type: action.type || row.type, source: 'mine' }
    } catch {}

    const mineRes = await apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 50, search: row.name }, timeoutMs: 10000 })
    const existing = pickActionRows((mineRes as any).data, 'mine').find((item) => item.name === row.name)
    return existing || row
  }

  async function addExercise(row: PickerAction) {
    if (!execution?.id || syncing) return
    setSyncing(true)
    try {
      const action = await ensureStudentAction(row)
      if (!action.id) throw new Error('动作缺少 ID，无法加入训练')
      await apiClient.request(isImpromptu ? '/api/impromptu/extra-content/add-extra-exercise' : '/api/execution/extra-content/add-extra-exercise', {
        method: 'POST',
        body: {
          executionId: execution.id,
          actionId: action.id,
          actionName: action.name,
          sets: [{ weight: null, reps: null }],
        },
        timeoutMs: 15000,
      })
      setPickerVisible(false)
      await hydrateFromCloud()
    } catch (error) {
      Alert.alert('添加失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  async function finish() {
    if (!execution?.id || syncing) return
    setSyncing(true)
    try {
      const res = await apiClient.request(isImpromptu ? '/api/impromptu/finish' : '/api/execution/finish', { method: 'POST', body: { executionId: execution.id }, timeoutMs: 15000 })
      const next = normalizeExecution(pickData(res) || { ...execution, status: 'completed' })
      setExecution(next)
      await persistExecutionSnapshot(cacheKey, next)
      Alert.alert('训练已完成', '本次训练记录已保存。')
    } catch (error) {
      Alert.alert('完成失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !execution) {
    return (
      <Page title="训练执行" subtitle="正在进入训练">
        <SectionCard title="同步训练记录" description="优先读取本地缓存，同时拉取云端最新数据。">
          <ActivityIndicator color={colors.brand} />
        </SectionCard>
      </Page>
    )
  }

  if (!execution) {
    return (
      <Page title="训练执行" subtitle="还没有可执行的训练记录">
        <SectionCard title="从训练入口开始" description="计划训练需要选择具体计划日；即兴训练可以从动作库选择动作后马上开始。">
          <Pressable onPress={() => navigation.replace('ImpromptuTraining')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>开始即兴锻炼</Text>
          </Pressable>
        </SectionCard>
      </Page>
    )
  }

  return (
    <Page title={isImpromptu ? '即兴训练' : '训练执行'} subtitle={syncing ? '正在同步训练记录...' : isCompleted ? '本次训练已完成' : '记录当前组，云端返回后更新本地缓存'}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.heroLabel}>{isImpromptu ? '自由训练' : `计划第 ${params.dayIndex || execution.day_index || 1} 天`}</Text>
          <Text style={styles.heroTitle}>{progressText}</Text>
          <Text style={styles.heroSub}>已完成 / 总组数 · {isCompleted ? '本次用时' : '训练总时长'} {elapsedText}</Text>
        </View>
        <View style={styles.heroIcon}><IconFont name="icon-dumbbell" color={colors.brand} size={28} /></View>
      </View>

      {execution.execution_notice ? (
        <SectionCard title="执行计划阅读须知" description={String(execution.execution_notice)} />
      ) : null}

      {execution.action_executions.map((action: any) => (
        <SectionCard key={`${action.actionIndex}-${action.actionName}`} title={action.actionName} description={`${action.sets.filter((set: any) => set.status === 'completed').length}/${action.sets.length} 组已完成`}>
          {action.sets.map((set: any) => {
            const draft = getDraft(action.actionIndex, set.setIndex, set)
            const completed = set.status === 'completed'
            return (
              <View key={set.setIndex} style={[styles.setRow, completed && styles.setCompleted]}>
                <View style={styles.setHead}>
                  <Text style={styles.setTitle}>第 {set.setNumber} 组</Text>
                  <Pressable disabled={syncing || isCompleted} onPress={() => deleteSet(action.actionIndex, set.setIndex)}>
                    <Text style={styles.deleteText}>删除</Text>
                  </Pressable>
                </View>
                <Text style={styles.setPlan}>计划 {displayLoad(set.plannedWeight, set.plannedReps)}</Text>
                <View style={styles.inputs}>
                  <TextInput value={draft.weight} editable={!completed} onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { weight: value })} keyboardType="decimal-pad" placeholder="重量" placeholderTextColor={colors.textMuted} style={styles.input} />
                  <TextInput value={draft.reps} editable={!completed} onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { reps: value })} keyboardType="number-pad" placeholder="次数" placeholderTextColor={colors.textMuted} style={styles.input} />
                  {!isImpromptu ? <TextInput value={draft.rpe} editable={!completed} onChangeText={(value) => setDraft(action.actionIndex, set.setIndex, { rpe: value })} keyboardType="decimal-pad" placeholder="RPE" placeholderTextColor={colors.textMuted} style={styles.input} /> : null}
                  <Pressable disabled={completed || syncing} onPress={() => completeSet(action.actionIndex, set.setIndex, set)} style={[styles.doneButton, (completed || syncing) && styles.doneButtonDisabled]}>
                    <Text style={styles.doneButtonText}>{completed ? '已完成' : '完成'}</Text>
                  </Pressable>
                </View>
              </View>
            )
          })}
          <Pressable disabled={syncing || isCompleted} onPress={() => addSet(action.actionIndex, action)} style={styles.addButton}>
            <Text style={styles.addButtonText}>新增一组</Text>
          </Pressable>
          <Pressable disabled={syncing || isCompleted} onPress={() => deleteExercise(action.actionIndex)} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>删除额外动作</Text>
          </Pressable>
        </SectionCard>
      ))}

      <Pressable disabled={syncing || isCompleted} onPress={openActionPicker} style={styles.addExerciseButton}>
        <Text style={styles.addExerciseButtonText}>添加动作</Text>
      </Pressable>

      <Pressable disabled={syncing || isCompleted} onPress={finish} style={[styles.finishButton, (syncing || isCompleted) && styles.finishDisabled]}>
        <Text style={styles.finishButtonText}>{isCompleted ? '训练已完成' : '完成训练'}</Text>
      </Pressable>

      {isCompleted ? (
        <SectionCard title="训练打卡图" description="生成本次训练的分享卡片，保留小程序分享页的训练容量、组数、PR 统计。">
          <Pressable onPress={() => navigation.navigate('TrainingShare', { executionId: execution?.id })} style={styles.shareButton}>
            <IconFont name="icon-share" color={colors.brand} size={18} />
            <Text style={styles.shareButtonText}>分享本次训练</Text>
          </Pressable>
        </SectionCard>
      ) : null}

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加动作</Text>
              <Pressable onPress={() => setPickerVisible(false)}><Text style={styles.modalClose}>关闭</Text></Pressable>
            </View>
            <View style={styles.pickerSearch}>
              <TextInput value={pickerQuery} onChangeText={setPickerQuery} placeholder="搜索动作" placeholderTextColor={colors.textMuted} style={styles.pickerInput} returnKeyType="search" onSubmitEditing={() => loadPickerActions()} />
              <Pressable onPress={() => loadPickerActions()} style={styles.pickerSearchButton}><Text style={styles.pickerSearchText}>搜索</Text></Pressable>
            </View>
            {pickerLoading ? <ActivityIndicator color={colors.brand} /> : null}
            <ScrollView style={styles.pickerList}>
              {pickerActions.map((row) => (
                <Pressable key={`${row.source}-${row.id || row.name}`} onPress={() => addExercise(row)} style={styles.pickerRow}>
                  <View style={styles.pickerRowMain}>
                    <Text style={styles.pickerName}>{row.name}</Text>
                    <Text style={styles.pickerMeta}>{row.source === 'mine' ? '我的动作' : '公共动作'}{row.type ? ` · ${row.type}` : ''}</Text>
                  </View>
                  <IconFont name="icon-right-arrow" color={colors.textMuted} size={16} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Page>
  )
}

const styles = StyleSheet.create({
  hero: { minHeight: 132, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F' },
  heroLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: '700' },
  heroTitle: { marginTop: spacing.xs, color: '#FFFFFF', fontSize: 36, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  setRow: { gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  setCompleted: { opacity: 0.72 },
  setHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  setTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  setPlan: { color: colors.textSecondary, fontSize: 12 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
  inputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: { flex: 1, minHeight: 42, borderRadius: radius.md, paddingHorizontal: spacing.xs, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14 },
  doneButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  doneButtonDisabled: { backgroundColor: colors.textMuted },
  doneButtonText: { color: '#FFFFFF', fontWeight: '900' },
  addButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface },
  addButtonText: { color: colors.brand, fontWeight: '900' },
  deleteButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  deleteButtonText: { color: colors.danger, fontWeight: '800' },
  addExerciseButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.surface },
  addExerciseButtonText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  finishButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  finishDisabled: { opacity: 0.5 },
  finishButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  shareButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  shareButtonText: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
  modalPanel: { maxHeight: '82%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  modalClose: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  pickerSearch: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pickerInput: { flex: 1, color: colors.text, fontSize: 15 },
  pickerSearchButton: { minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  pickerSearchText: { color: '#FFFFFF', fontWeight: '800' },
  pickerList: { maxHeight: 440 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowMain: { flex: 1, gap: 4 },
  pickerName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  pickerMeta: { color: colors.textSecondary, fontSize: 12 },
})
