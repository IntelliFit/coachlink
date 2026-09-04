import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, FormField, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type ActionType = 'STRENGTH' | 'DIET' | 'CARDIO' | 'HABIT'

const ACTION_TYPES: Array<{ label: string; value: ActionType }> = [
  { label: '力量训练', value: 'STRENGTH' },
  { label: '饮食管理', value: 'DIET' },
  { label: '有氧运动', value: 'CARDIO' },
  { label: '习惯打卡', value: 'HABIT' },
]
const POSITIONS = ['胸部', '背部', '腿部', '肩部', '手臂', '核心', '其他']
const ATTRS = ['组数', '次数', '强度', '持续时间', '休息时间']

function typeLabel(value?: string) {
  return ACTION_TYPES.find((item) => item.value === value)?.label || '动作'
}

function splitText(value: string) {
  return value.split(/[,\n，、]/).map((item) => item.trim()).filter(Boolean)
}

function schemaNumber(value: string, factor = 1) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num * factor : undefined
}

export function CoachActionsScreen() {
  const navigation = useNavigation<Navigation>()
  const [actions, setActions] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [type, setType] = useState<ActionType | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const totalPages = Math.max(1, Math.ceil(total / 20))

  const load = useCallback(async (nextPage = page) => {
    try {
      setLoading(true)
      setError(null)
      const res = await safeRequest<any>('/api/action-lib/list-actions', {
        body: { page: nextPage, limit: 20, search: query || undefined, type: type || undefined },
      })
      const rows = Array.isArray(res?.actions) ? res.actions : []
      setActions(rows)
      setTotal(Number(res?.totalCount ?? rows.length))
      setPage(nextPage)
    } catch (e) {
      setActions([])
      setTotal(0)
      setError(e instanceof Error ? e.message : '动作库加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, query, type])

  useEffect(() => {
    void load(1)
  }, [query, type])

  async function deleteAction(action: any, removeReferences = false) {
    try {
      await safeRequest('/api/action-lib/delete-action', { body: { id: action.id, removeReferences } })
      await load(page)
    } catch (e) {
      const message = e instanceof Error ? e.message : '删除失败'
      if (!removeReferences && message.includes('正在被引用')) {
        Alert.alert('动作正在被引用', `${message}\n\n是否移除引用后删除？`, [
          { text: '取消', style: 'cancel' },
          { text: '移除并删除', style: 'destructive', onPress: () => void deleteAction(action, true) },
        ])
        return
      }
      Alert.alert('删除失败', message)
    }
  }

  return (
    <ScreenShell title="教练动作库" subtitle={`${total} 个教学动作、饮食、有氧和习惯项目。`} onBack={() => navigation.goBack()}>
      <Card style={styles.toolbar}>
        <View style={styles.searchRow}>
          <IconFont name="icon-search" size={20} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={() => setQuery(search.trim())} returnKeyType="search" placeholder="搜索名称或描述" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <View style={styles.typeRow}>
          {[{ label: '全部', value: '' as const }, ...ACTION_TYPES].map((item) => (
            <Pressable key={item.value || 'all'} accessibilityRole="radio" accessibilityLabel={`筛选动作类型：${item.label}`} accessibilityState={{ selected: type === item.value }} onPress={() => { setType(item.value); setPage(1) }} style={[styles.typePill, type === item.value && styles.typePillActive]}>
              <Text style={[styles.typeText, type === item.value && styles.typeTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <SolidButton label="新建动作" onPress={() => navigation.navigate('CoachActionEdit')} />
      </Card>

      {loading ? <LoadingState title="正在加载动作库" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && actions.length === 0 ? <EmptyState title="暂无动作" desc="先创建一个标准动作或教学项目。" icon="icon-dumbbell" /> : null}

      {!loading && !error ? actions.map((action) => (
        <Card key={String(action.id)} style={styles.actionCard}>
          <View style={styles.actionTop}>
            <View style={styles.actionIcon}>
              <IconFont name="icon-dumbbell" size={22} color={colors.surface} />
            </View>
            <View style={styles.actionMeta}>
              <Text style={styles.actionName}>{action.name || '未命名'}</Text>
              <Text style={styles.actionDesc}>{typeLabel(action.type)} · {Array.isArray(action.positions) ? action.positions.join('、') : '未配置部位'}</Text>
            </View>
          </View>
          {action.detail ? <Text style={styles.detailText} numberOfLines={2}>{action.detail}</Text> : null}
          <View style={styles.cardActions}>
            <SolidButton label="编辑" variant="secondary" onPress={() => navigation.navigate('CoachActionEdit', { id: action.id })} />
            <SolidButton label="删除" variant="danger" onPress={() => Alert.alert('确认删除', `确定删除「${action.name || '未命名'}」吗？`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deleteAction(action) }])} />
          </View>
        </Card>
      )) : null}

      {!loading && !error && total > 0 ? (
        <View style={styles.pager}>
          <SolidButton label="上一页" variant="secondary" disabled={page <= 1} onPress={() => void load(Math.max(1, page - 1))} />
          <Text style={styles.pageText}>第 {page} / {totalPages} 页</Text>
          <SolidButton label="下一页" variant="secondary" disabled={page >= totalPages} onPress={() => void load(Math.min(totalPages, page + 1))} />
        </View>
      ) : null}
    </ScreenShell>
  )
}

export function CoachActionEditScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachActionEdit'>>()
  const actionId = route.params?.id
  const isEdit = Boolean(actionId)
  const [loading, setLoading] = useState(Boolean(actionId))
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    detail: '',
    url: '',
    type: 'STRENGTH' as ActionType,
    positions: '胸部',
    attrs: '组数、次数、强度、休息时间',
    enableAutoWeightCompute: false,
    includesBodyWeight: false,
    calories: '',
    suggestedTime: '',
    distance: '',
    duration: '',
    pace: '',
    targetDuration: '',
  })

  const patch = (next: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...next }))

  useEffect(() => {
    if (!actionId) return
    async function load() {
      try {
        setLoading(true)
        const res = await safeRequest<any>('/api/action-lib/get-action', { body: { id: actionId } })
        const action = res?.action || {}
        const schema = action.item_schema || {}
        setForm({
          name: action.name || '',
          detail: action.detail || '',
          url: action.url || '',
          type: action.type || 'STRENGTH',
          positions: Array.isArray(action.positions) ? action.positions.join('、') : '',
          attrs: Array.isArray(action.attrs) ? action.attrs.join('、') : '',
          enableAutoWeightCompute: Boolean(action.enableAutoWeightCompute),
          includesBodyWeight: Boolean(action.includesBodyWeight),
          calories: schema.calories ? String(schema.calories) : '',
          suggestedTime: action.suggested_time || '',
          distance: schema.distance ? String(Number(schema.distance) / 1000) : '',
          duration: schema.duration ? String(Number(schema.duration) / 60) : '',
          pace: schema.pace ? String(schema.pace) : '',
          targetDuration: schema.target_duration ? String(schema.target_duration) : '',
        })
      } catch (e) {
        Alert.alert('加载失败', e instanceof Error ? e.message : '动作加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [actionId])

  async function save() {
    if (!form.name.trim()) {
      Alert.alert('缺少名称', '请输入动作或项目名称。')
      return
    }
    const itemSchema: Record<string, number> = {}
    if (form.type === 'DIET') {
      const calories = schemaNumber(form.calories)
      if (calories) itemSchema.calories = calories
    }
    if (form.type === 'CARDIO') {
      const distance = schemaNumber(form.distance, 1000)
      const duration = schemaNumber(form.duration, 60)
      const pace = schemaNumber(form.pace)
      if (distance) itemSchema.distance = distance
      if (duration) itemSchema.duration = duration
      if (pace) itemSchema.pace = pace
    }
    if (form.type === 'HABIT') {
      const targetDuration = schemaNumber(form.targetDuration)
      if (targetDuration) itemSchema.target_duration = targetDuration
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      detail: form.detail.trim() || undefined,
      url: form.url.trim() || undefined,
      type: form.type,
      positions: form.type === 'STRENGTH' ? splitText(form.positions) : undefined,
      attrs: form.type === 'STRENGTH' ? splitText(form.attrs) : undefined,
      enableAutoWeightCompute: form.type === 'STRENGTH' ? form.enableAutoWeightCompute : false,
      includesBodyWeight: form.type === 'STRENGTH' && form.enableAutoWeightCompute ? form.includesBodyWeight : false,
      suggested_time: form.type === 'DIET' && form.suggestedTime ? form.suggestedTime : undefined,
      item_schema: Object.keys(itemSchema).length ? itemSchema : undefined,
    }
    if (isEdit) payload.id = actionId

    try {
      setSaving(true)
      await safeRequest(isEdit ? '/api/action-lib/update-action' : '/api/action-lib/add-action', { body: payload })
      navigation.goBack()
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title={isEdit ? '编辑动作' : '新建动作'} onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载动作" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title={isEdit ? '编辑动作' : '新建动作'} subtitle="与小程序教练动作库字段保持一致。" onBack={() => navigation.goBack()}>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>项目分类</Text>
        <View style={styles.typeRow}>
          {ACTION_TYPES.map((item) => (
            <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={`动作类型：${item.label}`} accessibilityState={{ selected: form.type === item.value }} onPress={() => patch({ type: item.value })} style={[styles.typePill, form.type === item.value && styles.typePillActive]}>
              <Text style={[styles.typeText, form.type === item.value && styles.typeTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <FormField label={form.type === 'DIET' ? '饮食名称' : form.type === 'HABIT' ? '习惯名称' : '动作名称'} value={form.name} onChangeText={(name) => patch({ name })} />
        {form.type === 'STRENGTH' ? (
          <>
            <CheckRow label="智能重量计算" desc="计入学员问卷并支持计划生成自动计算负重" value={form.enableAutoWeightCompute} onChange={() => patch({ enableAutoWeightCompute: !form.enableAutoWeightCompute })} />
            {form.enableAutoWeightCompute ? <CheckRow label="包含自身体重" desc="例如引体向上会影响自动计算结果" value={form.includesBodyWeight} onChange={() => patch({ includesBodyWeight: !form.includesBodyWeight })} /> : null}
            <FormField label="训练部位" value={form.positions} onChangeText={(positions) => patch({ positions })} placeholder={POSITIONS.join('、')} />
            <FormField label="动作属性" value={form.attrs} onChangeText={(attrs) => patch({ attrs })} placeholder={ATTRS.join('、')} />
          </>
        ) : null}
        {form.type === 'DIET' ? (
          <>
            <FormField label="热量估算 kcal" value={form.calories} onChangeText={(calories) => patch({ calories })} keyboardType="numeric" />
            <FormField label="推荐进食时间" value={form.suggestedTime} onChangeText={(suggestedTime) => patch({ suggestedTime })} placeholder="08:00" />
          </>
        ) : null}
        {form.type === 'CARDIO' ? (
          <>
            <FormField label="距离 km" value={form.distance} onChangeText={(distance) => patch({ distance })} keyboardType="numeric" />
            <FormField label="时长 min" value={form.duration} onChangeText={(duration) => patch({ duration })} keyboardType="numeric" />
            <FormField label="配速 m/k" value={form.pace} onChangeText={(pace) => patch({ pace })} keyboardType="numeric" />
          </>
        ) : null}
        {form.type === 'HABIT' ? <FormField label="目标达成量" value={form.targetDuration} onChangeText={(targetDuration) => patch({ targetDuration })} keyboardType="numeric" /> : null}
        <FormField label="详细描述" value={form.detail} onChangeText={(detail) => patch({ detail })} multiline />
        <FormField label="演示视频 URL" value={form.url} onChangeText={(url) => patch({ url })} placeholder="https://..." />
      </Card>
      <SolidButton label={isEdit ? '更新' : '保存'} loading={saving} onPress={save} />
    </ScreenShell>
  )
}

function CheckRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: () => void }) {
  return (
    <Pressable onPress={onChange} style={styles.checkRow}>
      <View style={[styles.checkBox, value && styles.checkBoxOn]}>
        {value ? <IconFont name="icon-goumaijilu" size={16} color={colors.surface} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkDesc}>{desc}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.sm },
  searchRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typePill: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typePillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  typeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  typeTextActive: { color: colors.surface },
  actionCard: { gap: spacing.sm },
  actionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  actionMeta: { flex: 1, gap: 3 },
  actionName: { color: colors.text, fontSize: 17, fontWeight: '900' },
  actionDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  detailText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  pager: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pageText: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  formCard: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  checkBox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkBoxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: { color: colors.text, fontSize: 15, fontWeight: '900' },
  checkDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
})
