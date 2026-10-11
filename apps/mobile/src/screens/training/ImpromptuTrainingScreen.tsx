import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { useAuth } from '../../providers/AuthProvider'
import {
  executionSnapshotKey,
  findLatestInProgressImpromptuSnapshot,
  persistExecutionSnapshot,
} from './trainingCache'
import { pickArray, pickData } from './trainingModel'

type Props = NativeStackScreenProps<RootStackParamList, 'ImpromptuTraining'>

type ActionRow = {
  id?: string
  name: string
  type?: string
  attrs?: string[] | null
  source?: 'mine' | 'public'
}

export function ImpromptuTrainingScreen({ navigation }: Props) {
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : ''
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState<any | null>(null)
  const [recoveryLoading, setRecoveryLoading] = useState(true)
  const [actions, setActions] = useState<ActionRow[]>([])
  const [selected, setSelected] = useState<Record<string, ActionRow>>({})

  async function load(search = query) {
    setLoading(true)
    setError('')
    try {
      const [mineRes, publicRes] = await Promise.allSettled([
        apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 50, search }, timeoutMs: 10000 }),
        apiClient.request('/api/public-action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 50, search, status: 'published' }, timeoutMs: 10000 }),
      ])
      if (mineRes.status === 'rejected' && publicRes.status === 'rejected') {
        throw mineRes.reason || publicRes.reason
      }
      const mine = mineRes.status === 'fulfilled' ? pickArray(mineRes.value, ['actions', 'items', 'data']) : []
      const pub = publicRes.status === 'fulfilled' ? pickArray(publicRes.value, ['actions', 'items', 'data']) : []
      const seen = new Set<string>()
      const merged: ActionRow[] = []
      mine.forEach((row: any) => {
        const name = String(row.name || row.action_name || '').trim()
        const type = String(row.type || '').toUpperCase()
        if (!name || ['DIET', 'CARDIO', 'HABIT', 'REST'].includes(type)) return
        seen.add(name)
        merged.push({ id: row.id, name, type: row.type || row.category || row.muscle_group, attrs: row.attrs, source: 'mine' })
      })
      pub.forEach((row: any) => {
        const name = String(row.name || row.action_name || '').trim()
        const type = String(row.type || '').toUpperCase()
        if (!name || seen.has(name) || ['DIET', 'CARDIO', 'HABIT', 'REST'].includes(type)) return
        merged.push({ id: row.id, name, type: row.type || row.category || row.muscle_group, attrs: row.attrs, source: 'public' })
      })
      setActions(merged)
    } catch (loadError: any) {
      setError(loadError?.message || '动作加载失败，请稍后重试。')
    } finally {
      setLoading(false)
    }
  }

  async function loadRecovery() {
    setRecoveryLoading(true)
    const local = await findLatestInProgressImpromptuSnapshot(userId).catch((cacheError) => {
      console.warn('[mobile-training] failed to read impromptu recovery cache', cacheError)
      return null
    })
    if (local?.execution) setRecovery(local.execution)

    try {
      const res = await apiClient.request('/api/impromptu/current', {
        method: 'GET',
        timeoutMs: 12000,
      })
      const cloud = pickData(res)
      if (cloud?.id && String(cloud.status || '').toLowerCase() === 'in_progress') {
        setRecovery(cloud)
        if (userId) {
          await persistExecutionSnapshot(
            userId,
            executionSnapshotKey({ mode: 'impromptu', id: cloud.id }),
            cloud,
          )
        }
      } else {
        // 云端为准；本地旧的“进行中”状态不继续误导用户。
        setRecovery(null)
      }
    } catch (recoveryError) {
      if (!local) console.warn('[mobile-training] failed to load current impromptu execution', recoveryError)
    } finally {
      setRecoveryLoading(false)
    }
  }

  useEffect(() => {
    void load('')
    void loadRecovery()
  }, [userId])

  const selectedRows = useMemo(() => Object.values(selected), [selected])

  function toggle(row: ActionRow) {
    const key = row.id || row.name
    setSelected((current) => {
      const next = { ...current }
      if (next[key]) delete next[key]
      else next[key] = row
      return next
    })
  }

  async function start() {
    if (selectedRows.length === 0 || starting || recovery) return
    setStarting(true)
    try {
      const payload = selectedRows.map((row) => ({
        actionId: row.source === 'mine' ? row.id : undefined,
        actionName: row.name,
        attrs: row.attrs,
        sets: 1,
        reps: null,
        weight: null,
        restSeconds: null,
      }))
      const res = await apiClient.request('/api/impromptu/start', { method: 'POST', body: { actions: payload }, timeoutMs: 15000 })
      const data = pickData(res)
      if (!data?.id) throw new Error('即兴训练启动失败')
      if (userId) {
        await persistExecutionSnapshot(
          userId,
          executionSnapshotKey({ mode: 'impromptu', id: data.id }),
          data,
        ).catch((error) => {
          console.warn('[mobile-training] failed to persist impromptu snapshot', error)
        })
      }
      navigation.replace('TrainingExecution', { impromptuId: data.id } as any)
    } catch (error) {
      Alert.alert('开始失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setStarting(false)
    }
  }

  function resumeRecovery() {
    if (!recovery?.id) return
    navigation.replace('TrainingExecution', { impromptuId: String(recovery.id) } as any)
  }

  return (
    <Page title="即兴锻炼" subtitle="从个人动作库或公共动作库选择动作，马上开始记录。">
      {recoveryLoading && !recovery ? (
        <SectionCard title="检查未完成训练" description="正在同时检查本地快照与云端记录。">
          <ActivityIndicator color={colors.brand} />
        </SectionCard>
      ) : null}

      {recovery ? (
        <View style={styles.recoveryCard}>
          <View style={styles.recoveryIcon}><IconFont name="icon-time" color={colors.brand} size={22} /></View>
          <View style={styles.recoveryMain}>
            <Text style={styles.recoveryTitle}>有一场即兴训练尚未完成</Text>
            <Text style={styles.recoveryText}>
              已完成 {Number(recovery.completed_sets || 0)}/{Number(recovery.total_sets || 0)} 组。继续后会恢复最近一次记录。
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="继续未完成的即兴训练" onPress={resumeRecovery} style={styles.recoveryButton}>
            <Text style={styles.recoveryButtonText}>继续</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="重新加载动作列表" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => load()} style={styles.retryButton}><Text style={styles.retryText}>重新加载</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput accessibilityLabel="搜索训练动作" value={query} onChangeText={setQuery} placeholder="搜索动作" placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => load()} />
        <Pressable accessibilityRole="button" accessibilityLabel="搜索训练动作" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => load()} style={[styles.searchButton, loading && styles.disabled]}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
      </View>

      <SectionCard title={`已选择 ${selectedRows.length} 个力量动作`} description={recovery ? '请先继续并完成当前即兴训练，再开始新的一场。' : '每个动作先放入一组，进入执行页后可以继续加组。'}>
        <Pressable accessibilityRole="button" accessibilityLabel={recovery ? '已有训练进行中' : '开始即兴训练'} accessibilityState={{ disabled: selectedRows.length === 0 || starting || Boolean(recovery), busy: starting }} disabled={selectedRows.length === 0 || starting || Boolean(recovery)} onPress={start} style={[styles.primaryButton, (selectedRows.length === 0 || starting || Boolean(recovery)) && styles.disabled]}>
          {starting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{recovery ? '已有训练进行中' : '开始训练'}</Text>}
        </Pressable>
      </SectionCard>

      <SectionCard title="动作列表" description="优先展示我的动作；公共动作作为补充，避免空库时不能开始。">
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {!loading && actions.length === 0 ? <Text style={styles.empty}>暂无匹配动作。</Text> : null}
        {actions.map((row) => {
          const key = row.id || row.name
          const checked = Boolean(selected[key])
          return (
            <Pressable key={`${row.source}-${key}`} accessibilityRole="checkbox" accessibilityLabel={`${row.name}，${row.source === 'mine' ? '我的动作' : '公共动作'}`} accessibilityState={{ checked }} onPress={() => toggle(row)} style={[styles.actionRow, checked && styles.actionRowChecked]}>
              <View style={styles.checkCircle}>{checked ? <View style={styles.checkDot} /> : null}</View>
              <View style={styles.actionMain}>
                <Text style={styles.actionName}>{row.name}</Text>
                <Text style={styles.actionMeta}>{row.source === 'mine' ? '我的动作' : '公共动作'}{row.type ? ` · ${row.type}` : ''}</Text>
              </View>
            </Pressable>
          )
        })}
      </SectionCard>
    </Page>
  )
}

const styles = StyleSheet.create({
  recoveryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: '#1F1F1F' },
  recoveryIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  recoveryMain: { flex: 1, gap: 4 },
  recoveryTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  recoveryText: { color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 18 },
  recoveryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brand },
  recoveryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  errorCard: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#FFF1EE', borderWidth: 1, borderColor: '#F2C7BC' },
  errorText: { color: '#9A3F2B', fontSize: 13, lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  retryText: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchButton: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontWeight: '800' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  actionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionRowChecked: { opacity: 0.92 },
  checkCircle: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brand },
  checkDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  actionMain: { flex: 1, gap: 4 },
  actionName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  actionMeta: { color: colors.textSecondary, fontSize: 12 },
})
