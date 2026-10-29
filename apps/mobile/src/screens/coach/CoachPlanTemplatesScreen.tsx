import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import * as Clipboard from 'expo-clipboard'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, FormField, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'
import { PlanDaysEditor } from '../plan/PlanDaysEditor'
import { SUITABLE_FOR_LABELS, createDefaultPlanDays, normalizePlanDays } from '../plan/model/planEditor'
import { finalizeDays, findUnpickedStrength, prepareDaysForEditor } from '../plan/model/planDayOps'
import type { PlanActionOption, PlanTrainingDay } from '../plan/model/planTypes'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type TemplateType = '' | 'beginner' | 'strength'

const TYPE_OPTIONS: Array<{ label: string; value: TemplateType }> = [
  { label: '全部类型', value: '' },
  { label: '新手训练', value: 'beginner' },
  { label: '力量训练', value: 'strength' },
]

function dateText(value?: string | null) {
  return value ? String(value).slice(0, 10) : '-'
}

function parseTags(text: string) {
  return text.split(/[,\n，、]/).map((item) => item.trim()).filter(Boolean)
}


export function CoachPlanTemplatesScreen() {
  const navigation = useNavigation<Navigation>()
  const isTopLevelTab = useRoute().name === 'CoachPlanTemplatesTab'
  const backAction = isTopLevelTab ? undefined : () => navigation.goBack()
  const [templates, setTemplates] = useState<any[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TemplateType>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const visibleTemplates = useMemo(() => {
    if (!selectedTag) return templates
    return templates.filter((item) => Array.isArray(item.tags) && item.tags.includes(selectedTag))
  }, [selectedTag, templates])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [templateRes, tagRes] = await Promise.all([
        safeRequest<any>('/api/plan-lib/list-templates', { body: { page: 1, limit: 100, search, type } }),
        safeRequest<any>('/api/plan-lib/get-unique-template-tags', { body: { search, type } }).catch(() => null),
      ])
      setTemplates(Array.isArray(templateRes?.templates) ? templateRes.templates : [])
      setTags(Array.isArray(tagRes?.tags) ? tagRes.tags : [])
    } catch (e) {
      setTemplates([])
      setTags([])
      setError(e instanceof Error ? e.message : '计划模板加载失败')
    } finally {
      setLoading(false)
    }
  }, [search, type])

  useEffect(() => {
    void load()
  }, [load])

  async function exportTemplate(template: any) {
    try {
      const res = await safeRequest<any>('/api/plan-lib/export-template-text', { body: { id: template.id } })
      if (!res?.text) throw new Error('导出内容为空')
      await Clipboard.setStringAsync(res.text)
      Alert.alert('已复制', '模板文本已复制到剪贴板。')
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : '请稍后重试')
    }
  }

  async function copyTemplate(template: any) {
    try {
      await safeRequest('/api/plan-lib/copy-template', { body: { id: template.id } })
      await load()
    } catch (e) {
      Alert.alert('复制失败', e instanceof Error ? e.message : '请稍后重试')
    }
  }

  async function deleteTemplate(template: any) {
    try {
      await safeRequest('/api/plan-lib/delete-template', { body: { id: template.id } })
      await load()
    } catch (e) {
      Alert.alert('删除失败', e instanceof Error ? e.message : '请稍后重试')
    }
  }

  return (
    <ScreenShell title="教练计划库" subtitle="搜索、筛选、复制和管理训练模板。" onBack={backAction} tabBarInset={isTopLevelTab}>
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>计划库</Text>
            <Text style={styles.heroDesc}>模板会用于学员分配、AI 生成和后续阶段计划。</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="新建计划模板" onPress={() => navigation.navigate('CoachPlanTemplateEdit')} style={styles.createButton}>
            <Text style={styles.createText}>新建</Text>
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <IconFont name="icon-search" size={20} color={colors.textMuted} />
          <TextInput accessibilityLabel="搜索计划模板" accessibilityHint="输入模板名称或描述后搜索" value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => { setSearch(searchDraft.trim()); setSelectedTag('') }} returnKeyType="search" placeholder="搜索模板名称或描述" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <View style={styles.filterRow}>
          {TYPE_OPTIONS.map((item) => (
            <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`筛选${item.label}`} accessibilityState={{ selected: type === item.value }} onPress={() => { setType(item.value); setSelectedTag('') }} style={[styles.chip, type === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, type === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {tags.length > 0 ? (
          <View style={styles.filterRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="筛选全部标签" accessibilityState={{ selected: !selectedTag }} onPress={() => setSelectedTag('')} style={[styles.tagChip, !selectedTag && styles.tagChipActive]}>
              <Text style={[styles.tagText, !selectedTag && styles.tagTextActive]}>全部标签</Text>
            </Pressable>
            {tags.slice(0, 8).map((tag) => (
              <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`筛选标签${tag}`} accessibilityState={{ selected: selectedTag === tag }} onPress={() => setSelectedTag(tag)} style={[styles.tagChip, selectedTag === tag && styles.tagChipActive]}>
                <Text style={[styles.tagText, selectedTag === tag && styles.tagTextActive]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Card>

      {loading ? <LoadingState title="正在加载计划模板" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && visibleTemplates.length === 0 ? <EmptyState title="没有匹配模板" desc="可以新建模板，或调整搜索与筛选条件。" icon="icon-a-Trainingplan" /> : null}

      {!loading && !error ? visibleTemplates.map((template) => (
        <Card key={String(template.id)} style={styles.templateCard}>
          <Pressable onPress={() => navigation.navigate('CoachPlanTemplateEdit', { id: template.id })} style={styles.templateMain}>
            <Text style={styles.templateTitle}>{template.name || '未命名模板'}</Text>
            <Text style={styles.templateDesc}>{template.description || '暂无模板说明'}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{template.trainingDaysCount ?? template.training_days_count ?? 0} 天训练</Text>
              <Text style={styles.metaText}>{dateText(template.updatedAt || template.updated_at || template.createdAt || template.created_at)}</Text>
            </View>
            {Array.isArray(template.tags) && template.tags.length > 0 ? (
              <View style={styles.filterRow}>
                {template.tags.slice(0, 4).map((tag: string) => <Text key={`${template.id}-${tag}`} style={styles.inlineTag}>{tag}</Text>)}
              </View>
            ) : null}
          </Pressable>
          <View style={styles.actionRow}>
            <SolidButton label="导出" variant="secondary" onPress={() => void exportTemplate(template)} />
            <SolidButton label="复制" variant="secondary" onPress={() => void copyTemplate(template)} />
            <SolidButton label="删除" variant="danger" onPress={() => Alert.alert('删除模板', '删除后不可恢复，确认继续吗？', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deleteTemplate(template) }])} />
          </View>
        </Card>
      )) : null}
    </ScreenShell>
  )
}

export function CoachPlanTemplateEditScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachPlanTemplateEdit'>>()
  const templateId = route.params?.id
  const isEdit = Boolean(templateId)
  const [loading, setLoading] = useState(Boolean(templateId))
  const [saving, setSaving] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [importText, setImportText] = useState('')
  const [actions, setActions] = useState<PlanActionOption[]>([])
  const [days, setDays] = useState<PlanTrainingDay[]>(() => createDefaultPlanDays(1, 'coach'))
  const [form, setForm] = useState({
    name: '',
    description: '',
    executionNotice: '',
    tags: '',
    suitableFor: 'beginner',
    type: 'custom',
  })

  const patch = (next: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...next }))

  useEffect(() => {
    // 动作选择器用教练动作库；失败时编辑器仍可用，只是不能新选动作。
    safeRequest<any>('/api/action-lib/list-actions', { body: { page: 1, limit: 500 } })
      .then((res) => setActions(Array.isArray(res?.actions) ? res.actions : []))
      .catch(() => setActions([]))
  }, [])

  useEffect(() => {
    if (!templateId) return
    async function load() {
      try {
        setLoading(true)
        const res = await safeRequest<any>('/api/plan-lib/get-template', { body: { id: templateId } })
        const template = res?.template || {}
        setForm({
          name: template.name || '',
          description: template.description || '',
          executionNotice: template.execution_notice || template.executionNotice || '',
          tags: Array.isArray(template.tags) ? template.tags.join('、') : '',
          suitableFor: template.suitable_for || template.suitableFor || 'beginner',
          type: template.type || 'custom',
        })
        if (Array.isArray(res?.days) && res.days.length > 0) setDays(prepareDaysForEditor(res.days))
      } catch (e) {
        Alert.alert('加载失败', e instanceof Error ? e.message : '模板加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [templateId])

  async function parseImportText() {
    if (!importText.trim()) {
      Alert.alert('请先粘贴计划文本')
      return
    }
    if (actions.length === 0) {
      Alert.alert('动作库为空', '解析需要按你的动作库匹配动作，请先添加动作。')
      return
    }
    setParsing(true)
    try {
      const data = await safeRequest<any>('/api/plan-lib/parse-template', {
        body: { text: importText, actions: actions.map((action) => ({ id: action.id, name: action.name, type: action.type || undefined, attrs: action.attrs || undefined })) },
      })
      const parsed = Array.isArray(data?.trainingDays) ? prepareDaysForEditor(data.trainingDays) : []
      if (parsed.length === 0) throw new Error('没有解析出训练日')
      setDays(parsed)
      if (data?.globalDescription && !form.description.trim()) patch({ description: String(data.globalDescription) })
      Alert.alert('已解析', `已生成 ${parsed.length} 天的安排，请检查后保存。`)
    } catch (e) {
      Alert.alert('解析失败', e instanceof Error ? e.message : '请调整文本后重试')
    } finally {
      setParsing(false)
    }
  }

  async function save() {
    if (!form.name.trim()) {
      Alert.alert('缺少名称', '请输入模板名称。')
      return
    }
    const unpicked = findUnpickedStrength(days)
    if (unpicked) {
      Alert.alert('还有动作未选择', `第 ${unpicked.dayIndex} 天的第 ${unpicked.setIndex + 1} 个力量项还没选动作。`)
      return
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      executionNotice: form.executionNotice.trim() || null,
      tags: parseTags(form.tags),
      suitableFor: form.suitableFor || 'beginner',
      type: form.type || null,
      trainingDays: finalizeDays(days),
    }
    if (isEdit) payload.id = templateId
    try {
      setSaving(true)
      await safeRequest(isEdit ? '/api/plan-lib/update-template' : '/api/plan-lib/create-template', { body: payload })
      navigation.goBack()
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title={isEdit ? '编辑计划模板' : '新建计划模板'} onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载模板" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title={isEdit ? '编辑计划模板' : '新建计划模板'} subtitle="基础信息、文本导入和按周训练日编辑。" onBack={() => navigation.goBack()}>
      <Card style={styles.formCard}>
        <FormField label="模板名称" value={form.name} onChangeText={(name) => patch({ name })} />
        <FormField label="详情描述" value={form.description} onChangeText={(description) => patch({ description })} multiline />
        <FormField label="执行须知" value={form.executionNotice} onChangeText={(executionNotice) => patch({ executionNotice })} multiline />
        <FormField label="标签" value={form.tags} onChangeText={(tags) => patch({ tags })} placeholder="增肌、上肢、入门" />
        <View style={styles.levelRow}>
          {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
            <Pressable key={level} accessibilityRole="tab" accessibilityState={{ selected: form.suitableFor === level }} onPress={() => patch({ suitableFor: level })} style={[styles.levelChip, form.suitableFor === level && styles.levelChipActive]}>
              <Text style={[styles.levelText, form.suitableFor === level && styles.levelTextActive]}>{SUITABLE_FOR_LABELS[level]}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>文本导入</Text>
        <FormField label="粘贴计划文本" value={importText} onChangeText={setImportText} multiline placeholder="粘贴一段训练安排，系统按你的动作库解析成训练日。" />
        <SolidButton label="解析文本" variant="secondary" loading={parsing} onPress={() => void parseImportText()} />
      </Card>
      <Card style={styles.formCard}>
        <Text style={styles.sectionTitle}>训练日</Text>
        <PlanDaysEditor days={days} onChange={setDays} actions={actions} mode="coach" />
      </Card>
      <SolidButton label={isEdit ? '保存模板' : '创建模板'} loading={saving} onPress={() => void save()} />
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '700' },
  heroDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  createButton: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  createText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
  tagChip: { minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tagChipActive: { backgroundColor: colors.brandSoft },
  tagText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tagTextActive: { color: colors.brand },
  templateCard: { gap: spacing.sm },
  templateMain: { gap: spacing.xs },
  templateTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  templateDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  metaText: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  inlineTag: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft, color: colors.brand, fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  formCard: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  levelRow: { flexDirection: 'row', gap: spacing.xs },
  levelChip: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  levelChipActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  levelText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  levelTextActive: { color: colors.brandDark, fontWeight: '700' },
})
