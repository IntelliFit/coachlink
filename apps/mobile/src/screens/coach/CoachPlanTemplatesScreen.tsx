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

type Navigation = NativeStackNavigationProp<RootStackParamList>
type TemplateType = '' | 'beginner' | 'strength'

const TYPE_OPTIONS: Array<{ label: string; value: TemplateType }> = [
  { label: '全部类型', value: '' },
  { label: '新手训练', value: 'beginner' },
  { label: '力量训练', value: 'strength' },
]

const DEFAULT_TRAINING_DAYS = [
  {
    dayIndex: 1,
    type: 'rest',
    title: '休息日',
    actionSets: [],
  },
]

function dateText(value?: string | null) {
  return value ? String(value).slice(0, 10) : '-'
}

function parseTags(text: string) {
  return text.split(/[,\n，、]/).map((item) => item.trim()).filter(Boolean)
}

function parseJsonDays(text: string) {
  if (!text.trim()) return DEFAULT_TRAINING_DAYS
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('trainingDays 必须是非空数组')
  return parsed
}

export function CoachPlanTemplatesScreen() {
  const navigation = useNavigation<Navigation>()
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
    <ScreenShell title="教练计划库" subtitle="搜索、筛选、复制和管理训练模板。" onBack={() => navigation.goBack()}>
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>计划库</Text>
            <Text style={styles.heroDesc}>模板会用于学员分配、AI 生成和后续阶段计划。</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('CoachPlanTemplateEdit')} style={styles.createButton}>
            <Text style={styles.createText}>新建</Text>
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <IconFont name="icon-search" size={20} color={colors.textMuted} />
          <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => { setSearch(searchDraft.trim()); setSelectedTag('') }} returnKeyType="search" placeholder="搜索模板名称或描述" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <View style={styles.filterRow}>
          {TYPE_OPTIONS.map((item) => (
            <Pressable key={item.label} onPress={() => { setType(item.value); setSelectedTag('') }} style={[styles.chip, type === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, type === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {tags.length > 0 ? (
          <View style={styles.filterRow}>
            <Pressable onPress={() => setSelectedTag('')} style={[styles.tagChip, !selectedTag && styles.tagChipActive]}>
              <Text style={[styles.tagText, !selectedTag && styles.tagTextActive]}>全部标签</Text>
            </Pressable>
            {tags.slice(0, 8).map((tag) => (
              <Pressable key={tag} onPress={() => setSelectedTag(tag)} style={[styles.tagChip, selectedTag === tag && styles.tagChipActive]}>
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
  const [form, setForm] = useState({
    name: '',
    description: '',
    executionNotice: '',
    tags: '',
    suitableFor: 'beginner',
    type: 'custom',
    trainingDaysJson: JSON.stringify(DEFAULT_TRAINING_DAYS, null, 2),
  })

  const patch = (next: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...next }))

  useEffect(() => {
    if (!templateId) return
    async function load() {
      try {
        setLoading(true)
        const res = await safeRequest<any>('/api/plan-lib/get-template', { body: { id: templateId } })
        const template = res?.template || {}
        const days = Array.isArray(res?.days) && res.days.length > 0 ? res.days : DEFAULT_TRAINING_DAYS
        setForm({
          name: template.name || '',
          description: template.description || '',
          executionNotice: template.execution_notice || template.executionNotice || '',
          tags: Array.isArray(template.tags) ? template.tags.join('、') : '',
          suitableFor: template.suitable_for || template.suitableFor || 'beginner',
          type: template.type || 'custom',
          trainingDaysJson: JSON.stringify(days, null, 2),
        })
      } catch (e) {
        Alert.alert('加载失败', e instanceof Error ? e.message : '模板加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [templateId])

  async function save() {
    if (!form.name.trim()) {
      Alert.alert('缺少名称', '请输入模板名称。')
      return
    }
    let trainingDays: any[]
    try {
      trainingDays = parseJsonDays(form.trainingDaysJson)
    } catch (e) {
      Alert.alert('训练日 JSON 无效', e instanceof Error ? e.message : '请检查 JSON 格式')
      return
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      executionNotice: form.executionNotice.trim() || null,
      tags: parseTags(form.tags),
      suitableFor: form.suitableFor || 'beginner',
      type: form.type || null,
      trainingDays,
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
    <ScreenShell title={isEdit ? '编辑计划模板' : '新建计划模板'} subtitle="基础信息与训练日结构；完整原生工作台会继续深化。" onBack={() => navigation.goBack()}>
      <Card style={styles.formCard}>
        <FormField label="模板名称" value={form.name} onChangeText={(name) => patch({ name })} />
        <FormField label="详情描述" value={form.description} onChangeText={(description) => patch({ description })} multiline />
        <FormField label="执行须知" value={form.executionNotice} onChangeText={(executionNotice) => patch({ executionNotice })} multiline />
        <FormField label="标签" value={form.tags} onChangeText={(tags) => patch({ tags })} placeholder="增肌、上肢、入门" />
        <FormField label="适合人群" value={form.suitableFor} onChangeText={(suitableFor) => patch({ suitableFor })} placeholder="beginner / intermediate / advanced" />
        <FormField label="模板类型" value={form.type} onChangeText={(type) => patch({ type })} placeholder="custom / beginner / strength" />
        <View style={styles.jsonHintBox}>
          <Text style={styles.jsonHintTitle}>训练日 JSON</Text>
          <Text style={styles.jsonHint}>可粘贴小程序/网页导出的 trainingDays 数组。当前默认保留一个休息日，避免空模板写入。</Text>
        </View>
        <FormField label="trainingDays" value={form.trainingDaysJson} onChangeText={(trainingDaysJson) => patch({ trainingDaysJson })} multiline />
      </Card>
      <SolidButton label={isEdit ? '保存模板' : '创建模板'} loading={saving} onPress={save} />
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  heroDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  createButton: { minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  createText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 38, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.surface },
  tagChip: { minHeight: 32, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tagChipActive: { backgroundColor: colors.brandSoft },
  tagText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  tagTextActive: { color: colors.brand },
  templateCard: { gap: spacing.sm },
  templateMain: { gap: spacing.xs },
  templateTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  templateDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  metaText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  inlineTag: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft, color: colors.brand, fontSize: 11, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  formCard: { gap: spacing.sm },
  jsonHintBox: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandSoft, gap: 4 },
  jsonHintTitle: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  jsonHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
})
