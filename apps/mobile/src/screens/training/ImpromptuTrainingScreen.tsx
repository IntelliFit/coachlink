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
import { executionSnapshotKey, persistExecutionSnapshot } from './trainingCache'
import { pickArray, pickData } from './trainingModel'

type Props = NativeStackScreenProps<RootStackParamList, 'ImpromptuTraining'>

type ActionRow = {
  id?: string
  name: string
  type?: string
  source?: 'mine' | 'public'
}

export function ImpromptuTrainingScreen({ navigation }: Props) {
  const { user } = useAuth()
  const userId = user?.id ? String(user.id) : ''
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [actions, setActions] = useState<ActionRow[]>([])
  const [selected, setSelected] = useState<Record<string, ActionRow>>({})

  async function load(search = query) {
    setLoading(true)
    try {
      const [mineRes, publicRes] = await Promise.allSettled([
        apiClient.request('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 50, search }, timeoutMs: 10000 }),
        apiClient.request('/api/public-action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 50, search, status: 'published' }, timeoutMs: 10000 }),
      ])
      const mine = mineRes.status === 'fulfilled' ? pickArray((mineRes.value as any).data, ['actions', 'items', 'data']) : []
      const pub = publicRes.status === 'fulfilled' ? pickArray((publicRes.value as any).data, ['actions', 'items', 'data']) : []
      const seen = new Set<string>()
      const merged: ActionRow[] = []
      mine.forEach((row: any) => {
        const name = String(row.name || row.action_name || '').trim()
        if (!name) return
        seen.add(name)
        merged.push({ id: row.id, name, type: row.type || row.category || row.muscle_group, source: 'mine' })
      })
      pub.forEach((row: any) => {
        const name = String(row.name || row.action_name || '').trim()
        if (!name || seen.has(name)) return
        merged.push({ id: row.id, name, type: row.type || row.category || row.muscle_group, source: 'public' })
      })
      setActions(merged)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load('')
  }, [])

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
    if (selectedRows.length === 0 || starting) return
    setStarting(true)
    try {
      const payload = selectedRows.map((row) => ({
        actionId: row.source === 'mine' ? row.id : undefined,
        actionName: row.name,
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

  return (
    <Page title="即兴锻炼" subtitle="从个人动作库或公共动作库选择动作，马上开始记录。">
      <View style={styles.searchBox}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput value={query} onChangeText={setQuery} placeholder="搜索动作" placeholderTextColor={colors.textMuted} style={styles.searchInput} returnKeyType="search" onSubmitEditing={() => load()} />
        <Pressable onPress={() => load()} style={styles.searchButton}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
      </View>

      <SectionCard title={`已选择 ${selectedRows.length} 个动作`} description="即兴训练会为每个动作先放入一组，进入执行页后可以继续加组。">
        <Pressable disabled={selectedRows.length === 0 || starting} onPress={start} style={[styles.primaryButton, (selectedRows.length === 0 || starting) && styles.disabled]}>
          {starting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>开始训练</Text>}
        </Pressable>
      </SectionCard>

      <SectionCard title="动作列表" description="优先展示我的动作；公共动作作为补充，避免空库时不能开始。">
        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {!loading && actions.length === 0 ? <Text style={styles.empty}>暂无匹配动作。</Text> : null}
        {actions.map((row) => {
          const key = row.id || row.name
          const checked = Boolean(selected[key])
          return (
            <Pressable key={`${row.source}-${key}`} onPress={() => toggle(row)} style={[styles.actionRow, checked && styles.actionRowChecked]}>
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
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.lg, paddingHorizontal: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchButton: { minHeight: 38, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontWeight: '800' },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.48 },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionRowChecked: { opacity: 0.92 },
  checkCircle: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brand },
  checkDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  actionMain: { flex: 1, gap: 4 },
  actionName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  actionMeta: { color: colors.textSecondary, fontSize: 12 },
})
