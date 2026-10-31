import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import type { RootStackParamList } from '../../navigation/types'
import { IconFont } from '../../components/IconFont'
import { colors, radius, spacing } from '../../theme'
import {
  Card,
  EmptyState,
  LoadingState,
  ScreenShell,
  SolidButton,
  safeRequest,
} from '../me/MeShared'
import { assignPlanSuccessMessage, buildAssignPlanRequest, type AssignPlanMode } from './assignPlanRequest'

type Navigation = NativeStackNavigationProp<RootStackParamList>

function templateDayCount(template: any) {
  return Number(
    template?.trainingDaysCount ?? template?.training_days_count ?? template?.days_count ?? 0,
  )
}

export function CoachAssignPlanScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachAssignPlan'>>()
  const subscriptionId = String(route.params?.subscriptionId || '')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [templates, setTemplates] = useState<any[]>([])
  const [currentPlan, setCurrentPlan] = useState<any | null>(null)
  const [currentExecutions, setCurrentExecutions] = useState<Record<number, any>>({})
  // 读不到当前计划时不能分配：会把「覆盖」误当成新建，按替换计费且丢掉已练天
  const [currentPlanError, setCurrentPlanError] = useState('')
  // 与小程序一致：已有当前计划时默认「覆盖当前计划」
  const [mode, setMode] = useState<AssignPlanMode>('overwrite')
  const [selectedId, setSelectedId] = useState('')
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null)
  const [startWeek, setStartWeek] = useState('1')
  const [startDay, setStartDay] = useState('1')

  const load = useCallback(async (query = '') => {
    if (!subscriptionId) return
    try {
      query ? setSearching(true) : setLoading(true)
      setError('')
      const [templatesResult, instanceResult] = await Promise.allSettled([
        safeRequest<any>('/api/plan-lib/list-templates', {
          body: { page: 1, limit: 100, search: query || undefined },
        }),
        safeRequest<any>('/api/plan-lib/get-instance', {
          body: { subscriptionId },
        }),
      ])
      if (templatesResult.status === 'rejected') throw templatesResult.reason
      setTemplates(Array.isArray(templatesResult.value?.templates) ? templatesResult.value.templates : [])
      if (instanceResult.status === 'fulfilled') {
        setCurrentPlan(instanceResult.value?.instance || null)
        setCurrentExecutions(instanceResult.value?.executionsByDayIndex || {})
        setCurrentPlanError('')
      } else {
        setCurrentPlanError(instanceResult.reason instanceof Error ? instanceResult.reason.message : '当前计划读取失败')
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划模板加载失败')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }, [subscriptionId])

  useEffect(() => {
    void load('')
  }, [load])

  async function selectTemplate(template: any) {
    setSelectedId(String(template.id))
    try {
      const detail = await safeRequest<any>('/api/plan-lib/get-template', {
        body: { id: template.id },
      })
      setSelectedDetail(detail)
      setStartWeek('1')
      setStartDay('1')
    } catch (detailError) {
      setSelectedDetail(null)
      Alert.alert('模板加载失败', detailError instanceof Error ? detailError.message : '请稍后重试')
    }
  }

  const selectedTemplate = selectedDetail?.template
  const selectedDays = Array.isArray(selectedDetail?.days) ? selectedDetail.days : []
  const totalWeeks = Math.max(1, Math.ceil(Math.max(1, selectedDays.length) / 7))
  const startPosition = useMemo(() => {
    const week = Math.max(1, Math.floor(Number(startWeek) || 1))
    const day = Math.max(1, Math.min(7, Math.floor(Number(startDay) || 1)))
    return { week, day, index: (week - 1) * 7 + day }
  }, [startDay, startWeek])

  function requestAssign() {
    if (!selectedTemplate || selectedDays.length === 0 || assigning) return
    if (currentPlanError) {
      Alert.alert('请先重新加载', '学员当前计划没有读取成功，重新加载后再分配。')
      return
    }
    if (startPosition.index > selectedDays.length) {
      Alert.alert('起始位置无效', `该模板共 ${selectedDays.length} 天，请调整起始周和起始日。`)
      return
    }
    const replaceMessage = !currentPlan
      ? '计划会立即成为该学员的当前计划。'
      : mode === 'overwrite'
        ? `用模板内容覆盖当前计划“${currentPlan.name || '未命名计划'}”。已经练过的天会保留，训练记录不受影响。`
        : `当前计划“${currentPlan.name || '未命名计划'}”会归档保留历史，新阶段将成为当前计划。`
    Alert.alert(
      '确认分配计划',
      `${replaceMessage}\n\n从第 ${startPosition.week} 周第 ${startPosition.day} 天开始执行。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '确认分配', onPress: () => void assign() },
      ],
    )
  }

  async function assign() {
    if (!selectedTemplate || assigning) return
    setAssigning(true)
    try {
      const request = buildAssignPlanRequest({
        mode,
        subscriptionId,
        template: selectedTemplate,
        templateDays: selectedDays,
        startDayIndex: startPosition.index,
        currentPlan,
        executionsByDayIndex: currentExecutions,
      })
      const result = await safeRequest<any>(request.endpoint, { body: request.body })
      if (request.endpoint === '/api/plan-lib/create-instance' && !result?.instance?.id) throw new Error('服务端未返回计划实例')
      Alert.alert('分配成功', assignPlanSuccessMessage(request), [
        { text: '完成', onPress: () => navigation.goBack() },
      ])
    } catch (assignError) {
      Alert.alert('分配失败', assignError instanceof Error ? assignError.message : '请稍后重试')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <ScreenShell
      title="分配训练计划"
      subtitle={`为 ${route.params?.studentName || '学员'} 选择模板与起始训练日。`}
      onBack={() => navigation.goBack()}
    >
      {currentPlanError ? (
        <View style={styles.currentWarning}>
          <IconFont name="icon-wenhao" color={colors.brand} size={20} />
          <View style={styles.warningMain}>
            <Text style={styles.warningTitle}>学员当前计划读取失败</Text>
            <Text style={styles.warningText}>{currentPlanError}。重新加载成功后才能分配，避免误把当前计划当成不存在。</Text>
            <SolidButton label="重新加载" variant="secondary" onPress={() => void load(search.trim())} />
          </View>
        </View>
      ) : null}

      {currentPlan ? (
        <View style={styles.currentWarning}>
          <IconFont name="icon-a-Trainingplan" color={colors.brand} size={20} />
          <View style={styles.warningMain}>
            <Text style={styles.warningTitle}>当前计划：{currentPlan.name || '未命名计划'}</Text>
            <Text style={styles.warningText}>历史训练记录不会删除。可以覆盖当前计划，或另起一个新阶段。</Text>
          </View>
        </View>
      ) : null}

      {currentPlan ? (
        <View style={styles.modeRow}>
          {([
            { key: 'overwrite', title: '覆盖当前计划', desc: '保留已练过的天，之后的天换成模板内容' },
            { key: 'new_instance', title: '新建阶段', desc: '当前计划归档，从选定的起点开始新计划' },
          ] as const).map((item) => {
            const active = mode === item.key
            return (
              <Pressable key={item.key} accessibilityRole="radio" accessibilityState={{ checked: active }} accessibilityLabel={`${item.title}，${item.desc}`} onPress={() => setMode(item.key)} style={[styles.modeCard, active && styles.modeCardActive]}>
                <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>{item.title}</Text>
                <Text style={styles.modeDesc}>{item.desc}</Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <Card style={styles.searchCard}>
        <IconFont name="icon-search" color={colors.textMuted} size={18} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void load(search.trim())}
          returnKeyType="search"
          placeholder="搜索计划模板"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        <Pressable disabled={searching} onPress={() => void load(search.trim())} style={styles.searchButton}>
          <Text style={styles.searchText}>{searching ? '搜索中' : '搜索'}</Text>
        </Pressable>
      </Card>

      {loading ? <LoadingState title="正在加载计划模板" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {!loading && !error && templates.length === 0 ? <EmptyState title="暂无计划模板" desc="先在计划库创建模板，再为学员分配。" icon="icon-a-Trainingplan" /> : null}

      {!loading && !error ? templates.map((template) => {
        const selected = String(template.id) === selectedId
        return (
          <Pressable key={String(template.id)} onPress={() => void selectTemplate(template)} style={[styles.templateCard, selected && styles.templateCardSelected]}>
            <View style={styles.templateMain}>
              <Text style={styles.templateTitle}>{template.name || '未命名模板'}</Text>
              <Text style={styles.templateDescription} numberOfLines={2}>{template.description || '暂无模板说明'}</Text>
              <Text style={styles.templateMeta}>{templateDayCount(template)} 个训练日 · {Array.isArray(template.tags) ? template.tags.slice(0, 3).join(' · ') : '训练计划'}</Text>
            </View>
            <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
          </Pressable>
        )
      }) : null}

      {selectedTemplate ? (
        <Card style={styles.assignCard}>
          <Text style={styles.sectionTitle}>执行起点</Text>
          <Text style={styles.sectionDescription}>适用于中途加入的学员；默认从第 1 周第 1 天开始。</Text>
          <View style={styles.positionRow}>
            <View style={styles.positionField}>
              <Text style={styles.fieldLabel}>起始周（1-{totalWeeks}）</Text>
              <TextInput value={startWeek} onChangeText={setStartWeek} keyboardType="number-pad" style={styles.positionInput} />
            </View>
            <View style={styles.positionField}>
              <Text style={styles.fieldLabel}>起始日（1-7）</Text>
              <TextInput value={startDay} onChangeText={setStartDay} keyboardType="number-pad" style={styles.positionInput} />
            </View>
          </View>
          <Text style={styles.positionHint}>将从计划第 {startPosition.index} 天开始 · 共 {selectedDays.length} 天</Text>
          <SolidButton label={assigning ? '正在分配…' : !currentPlan ? '分配计划' : mode === 'overwrite' ? '覆盖当前计划' : '新建阶段'} loading={assigning} onPress={requestAssign} />
        </Card>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  currentWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#EBC0B3' },
  warningMain: { flex: 1, gap: 4 },
  warningTitle: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  warningText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: spacing.xs },
  modeCard: { flex: 1, gap: 4, minHeight: 72, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modeCardActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  modeTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  modeTitleActive: { color: colors.brand },
  modeDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  searchCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  searchInput: { flex: 1, minHeight: 40, color: colors.text, fontSize: 14 },
  searchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brand },
  searchText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  templateCardSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  templateMain: { flex: 1, gap: 4 },
  templateTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  templateDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  templateMeta: { color: colors.textTertiary, fontSize: 11 },
  radio: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  assignCard: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  sectionDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  positionRow: { flexDirection: 'row', gap: spacing.sm },
  positionField: { flex: 1, gap: spacing.xs },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  positionInput: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.lg, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  positionHint: { color: colors.brand, fontSize: 12, fontWeight: '600' },
})
