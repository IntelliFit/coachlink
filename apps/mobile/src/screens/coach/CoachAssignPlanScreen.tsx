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
    if (startPosition.index > selectedDays.length) {
      Alert.alert('起始位置无效', `该模板共 ${selectedDays.length} 天，请调整起始周和起始日。`)
      return
    }
    const replaceMessage = currentPlan
      ? `当前计划“${currentPlan.name || '未命名计划'}”会归档保留历史，新计划将成为当前计划。`
      : '计划会立即成为该学员的当前计划。'
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
      const result = await safeRequest<any>('/api/plan-lib/create-instance', {
        body: {
          subscriptionId,
          templateId: selectedTemplate.id,
          name: selectedTemplate.name,
          description: selectedTemplate.description || null,
          executionNotice:
            selectedTemplate.execution_notice || selectedTemplate.executionNotice || undefined,
          tags: selectedTemplate.tags || null,
          type: selectedTemplate.type || null,
          suitableFor: selectedTemplate.suitable_for || selectedTemplate.suitableFor || null,
          trainingDays: selectedDays,
          startWeek: startPosition.week,
          startDay: startPosition.day,
        },
      })
      if (!result?.instance?.id) throw new Error('服务端未返回计划实例')
      Alert.alert('分配成功', '新计划已同步到学员训练首页。', [
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
      {currentPlan ? (
        <View style={styles.currentWarning}>
          <IconFont name="icon-a-Trainingplan" color={colors.brand} size={20} />
          <View style={styles.warningMain}>
            <Text style={styles.warningTitle}>当前计划：{currentPlan.name || '未命名计划'}</Text>
            <Text style={styles.warningText}>重新分配会归档当前计划，历史训练记录不会删除。</Text>
          </View>
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
          <SolidButton label={assigning ? '正在分配…' : currentPlan ? '替换并分配计划' : '分配计划'} loading={assigning} onPress={requestAssign} />
        </Card>
      ) : null}
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  currentWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#EBC0B3' },
  warningMain: { flex: 1, gap: 4 },
  warningTitle: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  warningText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  searchCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  searchInput: { flex: 1, minHeight: 40, color: colors.text, fontSize: 14 },
  searchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brand },
  searchText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  templateCardSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  templateMain: { flex: 1, gap: 4 },
  templateTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  templateDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  templateMeta: { color: colors.textMuted, fontSize: 11 },
  radio: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.brand },
  radioDot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.brand },
  assignCard: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  sectionDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  positionRow: { flexDirection: 'row', gap: spacing.sm },
  positionField: { flex: 1, gap: spacing.xs },
  fieldLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  positionInput: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.lg, color: colors.text, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, fontSize: 15 },
  positionHint: { color: colors.brand, fontSize: 12, fontWeight: '800' },
})
