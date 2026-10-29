import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, FormField, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type QuestionType = 'text' | 'option' | 'times' | 'tags' | 'rm'
type EditorType = 'simple' | 'flow'
type SelectionMode = 'single' | 'multiple'

type Question = {
  id: string
  type: QuestionType
  question?: string
  options?: string[]
  selectionMode?: SelectionMode
  allowOther?: boolean
  actionIds?: string[]
  branching?: any
  media?: any[]
}

const LEGACY_TYPES: QuestionType[] = ['tags', 'times', 'rm']

function generateId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function dateText(value?: string | null) {
  if (!value) return '暂无更新时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无更新时间'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function questionLabel(question: Question) {
  if (question.type === 'tags') return '训练项目偏好（已下线）'
  if (question.type === 'times') return '每周训练次数（已下线）'
  if (question.type === 'rm') return '1RM 测试（已下线）'
  if (question.type === 'option') return question.selectionMode === 'multiple' ? '多选题' : '单选题'
  return '纯文本问答'
}

function questionTypeLabels(questions: Question[]) {
  const labels = new Set<string>()
  questions.forEach((question) => labels.add(questionLabel(question)))
  return Array.from(labels)
}

function hasBranching(questions: Question[]) {
  return questions.some((item: any) => {
    const branching = item?.branching
    if (!branching || typeof branching !== 'object') return false
    return Boolean(branching?.defaultNext !== undefined || (branching?.rules && Object.keys(branching.rules).length > 0))
  })
}

function parseOptions(text: string) {
  return text.split(/[,\n，、]/).map((item) => item.trim()).filter(Boolean)
}

export function CoachQuestionnairesScreen() {
  const navigation = useNavigation<Navigation>()
  const [items, setItems] = useState<any[]>([])
  const [summaryMap, setSummaryMap] = useState<Record<string, { count: number; labels: string[]; branching: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState('')

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      if (a.is_default && !b.is_default) return -1
      if (!a.is_default && b.is_default) return 1
      return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))
    })
  }, [items])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await safeRequest<any>('/api/coach/list-questionnaires')
      const rows = Array.isArray(res?.items) ? res.items : []
      setItems(rows)
      const entries = await Promise.all(rows.map(async (item: any) => {
        try {
          const detail = await safeRequest<any>('/api/coach/get-questionnaire-by-id', { body: { id: item.id } })
          const questions = Array.isArray(detail?.questionnaires) ? detail.questionnaires as Question[] : []
          return [item.id, { count: questions.length, labels: questionTypeLabels(questions), branching: hasBranching(questions) }] as const
        } catch {
          return [item.id, { count: 0, labels: [], branching: false }] as const
        }
      }))
      setSummaryMap(Object.fromEntries(entries))
    } catch (e) {
      setItems([])
      setSummaryMap({})
      setError(e instanceof Error ? e.message : '问卷列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function setDefault(id: string) {
    try {
      setBusyId(id)
      await safeRequest('/api/coach/set-default-questionnaire', { body: { id } })
      await load()
    } catch (e) {
      Alert.alert('操作失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setBusyId('')
    }
  }

  async function duplicate(id: string) {
    try {
      setBusyId(id)
      await safeRequest('/api/coach/duplicate-questionnaire', { body: { id } })
      await load()
    } catch (e) {
      Alert.alert('复制失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setBusyId('')
    }
  }

  return (
    <ScreenShell title="学员问卷管理" subtitle="多份问卷，一份上线；学员填写当前发布版本。" onBack={() => navigation.goBack()}>
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>学员问卷管理</Text>
            <Text style={styles.heroTitle}>多份问卷，一份上线</Text>
            <Text style={styles.heroDesc}>维护任意多份模板，同一时间只有一份已发布问卷会给学员填写。</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('CoachQuestionnaireEdit')} style={styles.createButton}>
            <Text style={styles.createText}>新建</Text>
          </Pressable>
        </View>
      </Card>

      {loading ? <LoadingState title="正在加载问卷" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-pencil" /> : null}
      {!loading && !error && sorted.length === 0 ? <EmptyState title="还没有任何问卷" desc="新建一份列表式问卷开始配置。" icon="icon-pencil" /> : null}

      {!loading && !error ? sorted.map((item) => {
        const summary = summaryMap[item.id] || { count: 0, labels: [], branching: false }
        const isActive = item.status === 'active'
        const busy = busyId === item.id
        return (
          <Card key={item.id} style={[styles.templateCard, isActive ? styles.onlineCard : styles.draftCard]}>
            <View style={styles.templateHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.templateTitle}>{item.name || (isActive ? '已发布问卷' : '编辑中问卷')}</Text>
                <Text style={styles.templateMeta}>共 {summary.count} 题 · 最近更新 {dateText(item.updated_at || item.created_at)}</Text>
              </View>
              <Text style={styles.versionText}>v{item.version ?? 1}</Text>
            </View>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, isActive ? styles.onlineBadge : styles.draftBadge]}>{isActive ? '已发布' : '编辑中'}</Text>
              <Text style={styles.badge}>{item.editorType === 'flow' ? '流程图式' : '列表式'}</Text>
              {item.is_default ? <Text style={styles.defaultBadge}>默认</Text> : null}
            </View>
            <View style={styles.chipRow}>
              {summary.labels.length > 0 ? summary.labels.map((label) => <Text key={`${item.id}-${label}`} style={styles.typeChip}>{label}</Text>) : <Text style={styles.mutedChip}>暂未配置题目</Text>}
              {summary.branching ? <Text style={styles.typeChip}>含条件分支</Text> : null}
            </View>
            <View style={styles.actionRow}>
              <SolidButton label="编辑" variant="secondary" onPress={() => navigation.navigate('CoachQuestionnaireEdit', { id: item.id })} />
              <SolidButton label={busy ? '处理中' : '复制'} variant="secondary" disabled={busy} onPress={() => void duplicate(item.id)} />
              {!item.is_default ? <SolidButton label={busy ? '处理中' : '设默认'} disabled={busy} onPress={() => void setDefault(item.id)} /> : null}
            </View>
          </Card>
        )
      }) : null}
    </ScreenShell>
  )
}

export function CoachQuestionnaireEditScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachQuestionnaireEdit'>>()
  const questionnaireId = route.params?.id
  const isEdit = Boolean(questionnaireId)
  const [id, setId] = useState(questionnaireId || '')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'active' | 'draft'>('draft')
  const [editorType, setEditorType] = useState<EditorType>('simple')
  const [typePicked, setTypePicked] = useState(Boolean(questionnaireId))
  const [questions, setQuestions] = useState<Question[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(Boolean(questionnaireId))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!questionnaireId) return
    async function load() {
      try {
        setLoading(true)
        const res = await safeRequest<any>('/api/coach/get-questionnaire-by-id', { body: { id: questionnaireId } })
        setId(res?.id || questionnaireId)
        setName(res?.name || (res?.editorType === 'flow' ? '流程图问卷' : '列表问卷'))
        setStatus(res?.status === 'active' ? 'active' : 'draft')
        setEditorType(res?.editorType === 'flow' ? 'flow' : 'simple')
        setQuestions(Array.isArray(res?.questionnaires) ? res.questionnaires : [])
        setTypePicked(true)
      } catch (e) {
        Alert.alert('加载失败', e instanceof Error ? e.message : '问卷加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [questionnaireId])

  function pickEditorType(next: EditorType) {
    setEditorType(next)
    setName(next === 'flow' ? '流程图问卷' : '列表问卷')
    setTypePicked(true)
  }

  function addQuestion(kind: 'text' | 'single' | 'multiple') {
    const next: Question = kind === 'text'
      ? { id: generateId(), type: 'text', question: '' }
      : { id: generateId(), type: 'option', question: '', options: ['选项1', '选项2'], selectionMode: kind === 'multiple' ? 'multiple' : 'single', allowOther: false }
    setQuestions((prev) => [...prev, next])
    setEditingIndex(questions.length)
  }

  function patchQuestion(index: number, next: Partial<Question>) {
    setQuestions((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
    setEditingIndex((prev) => prev === index ? null : prev != null && prev > index ? prev - 1 : prev)
  }

  async function save() {
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i]
      if (!LEGACY_TYPES.includes(q.type) && !String(q.question || '').trim()) {
        Alert.alert('问题不能为空', `第 ${i + 1} 个问题不能为空。`)
        return
      }
      if (q.type === 'option' && (!Array.isArray(q.options) || q.options.length === 0 || q.options.some((option) => !String(option).trim()))) {
        Alert.alert('选项不能为空', `第 ${i + 1} 个问题的选项不能为空。`)
        return
      }
    }
    try {
      setSaving(true)
      const res = await safeRequest<any>('/api/coach/update-questionnaires', {
        body: {
          id: id || undefined,
          name: name.trim() || (editorType === 'flow' ? '流程图问卷' : '列表问卷'),
          editorType,
          questionnaires: questions,
        },
      })
      if (res?.id) setId(res.id)
      Alert.alert('已保存', '问卷已保存。')
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    if (!id) {
      Alert.alert('请先保存问卷', '保存后才能发布。')
      return
    }
    try {
      setSaving(true)
      await safeRequest('/api/coach/publish-questionnaire', { body: { id } })
      setStatus('active')
      Alert.alert('发布成功', '这份问卷已经成为学员填写版本。')
    } catch (e) {
      Alert.alert('发布失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title={isEdit ? '编辑问卷' : '新建问卷'} onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载问卷" />
      </ScreenShell>
    )
  }

  if (!typePicked) {
    return (
      <ScreenShell title="新建问卷" subtitle="类型一旦确认就不再切换，和小程序保持一致。" onBack={() => navigation.goBack()}>
        <Card style={styles.typePicker}>
          <Text style={styles.heroTitle}>请选择问卷类型</Text>
          <Text style={styles.heroDesc}>列表式适合绝大多数教练场景；流程图式用于复杂分级或条件分支。</Text>
          <Pressable onPress={() => pickEditorType('simple')} style={styles.typeCard}>
            <Text style={styles.typeCardTitle}>列表式问卷</Text>
            <Text style={styles.typeCardDesc}>按顺序提问，配置简单。</Text>
          </Pressable>
          <Pressable onPress={() => pickEditorType('flow')} style={styles.typeCard}>
            <Text style={styles.typeCardTitle}>流程图式问卷</Text>
            <Text style={styles.typeCardDesc}>保留分支能力；APP 先支持题目编辑，分支可视化后续深化。</Text>
          </Pressable>
        </Card>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title={status === 'active' ? '已发布问卷' : '编辑问卷'} subtitle="纯文本、单选、多选和旧题型维护。" onBack={() => navigation.goBack()}>
      <Card style={styles.formCard}>
        <FormField label="问卷名称" value={name} onChangeText={setName} placeholder="例如：新学员基础问卷" />
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, status === 'active' ? styles.onlineBadge : styles.draftBadge]}>{status === 'active' ? '已发布' : '编辑中'}</Text>
          <Text style={styles.badge}>{editorType === 'flow' ? '流程图式' : '列表式'}</Text>
        </View>
      </Card>

      {questions.length === 0 ? <EmptyState title="还没有问题" desc="点下方添加问题开始搭建问卷。" icon="icon-pencil" /> : null}
      {questions.map((question, index) => (
        <QuestionCard
          key={question.id || String(index)}
          question={question}
          index={index}
          editing={editingIndex === index}
          onToggle={() => setEditingIndex(editingIndex === index ? null : index)}
          onRemove={() => Alert.alert('确认删除', '确定要删除这个问题吗？', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => removeQuestion(index) }])}
          onChange={(next) => patchQuestion(index, next)}
        />
      ))}

      <Card style={styles.addCard}>
        <Text style={styles.fieldLabel}>添加问题</Text>
        <View style={styles.actionRow}>
          <SolidButton label="纯文本" variant="secondary" onPress={() => addQuestion('text')} />
          <SolidButton label="单选题" variant="secondary" onPress={() => addQuestion('single')} />
          <SolidButton label="多选题" variant="secondary" onPress={() => addQuestion('multiple')} />
        </View>
      </Card>

      <View style={styles.actionRow}>
        <SolidButton label="保存" loading={saving} onPress={save} />
        {status !== 'active' ? <SolidButton label="发布" variant="secondary" loading={saving} onPress={publish} /> : null}
      </View>
    </ScreenShell>
  )
}

function QuestionCard({
  question,
  index,
  editing,
  onToggle,
  onRemove,
  onChange,
}: {
  question: Question
  index: number
  editing: boolean
  onToggle: () => void
  onRemove: () => void
  onChange: (next: Partial<Question>) => void
}) {
  const legacy = LEGACY_TYPES.includes(question.type)
  const optionText = Array.isArray(question.options) ? question.options.join('、') : ''
  return (
    <Card style={[styles.questionCard, legacy && styles.legacyCard]}>
      <View style={styles.questionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.questionType, legacy && styles.legacyText]}>{questionLabel(question)}</Text>
          <Text style={styles.questionIndex}>#{index + 1}</Text>
        </View>
        {!legacy ? <SolidButton label={editing ? '收起' : '编辑'} variant="secondary" onPress={onToggle} /> : null}
        <SolidButton label="删除" variant="danger" onPress={onRemove} />
      </View>
      {legacy ? <Text style={styles.legacyDesc}>该题型已下线，仅可删除。新建问题请使用纯文本/单选/多选。</Text> : null}
      {!legacy && editing ? (
        <View style={styles.questionEditor}>
          <Text style={styles.fieldLabel}>问题内容</Text>
          <TextInput value={question.question || ''} onChangeText={(questionText) => onChange({ question: questionText })} multiline={question.type === 'text'} placeholder="请输入问题" placeholderTextColor={colors.textMuted} style={[styles.questionInput, question.type === 'text' && styles.questionTextarea]} />
          {question.type === 'option' ? (
            <>
              <FormField label="选项" value={optionText} onChangeText={(value) => onChange({ options: parseOptions(value) })} placeholder="选项1、选项2" multiline />
              <CheckRow label='增加"其他"选项，允许学员自补文字' value={Boolean(question.allowOther)} onPress={() => onChange({ allowOther: !question.allowOther })} />
            </>
          ) : null}
        </View>
      ) : null}
      {!legacy && !editing ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewText}>{question.question || '（未设置）'}</Text>
          {question.type === 'option' && Array.isArray(question.options) && question.options.length > 0 ? (
            <View style={styles.chipRow}>
              {question.options.map((option, optionIndex) => <Text key={`${question.id}-${optionIndex}`} style={styles.typeChip}>{optionIndex + 1}. {option}</Text>)}
              {question.allowOther ? <Text style={styles.typeChip}>其他（自补）</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}

function CheckRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.checkRow}>
      <View style={[styles.checkBox, value && styles.checkBoxOn]}>
        {value ? <IconFont name="icon-goumaijilu" size={16} color={colors.surface} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroEyebrow: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  heroDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
  createButton: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  createText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  templateCard: { gap: spacing.sm, borderWidth: 1 },
  onlineCard: { borderColor: 'rgba(16, 185, 129, 0.22)' },
  draftCard: { borderColor: colors.border },
  templateHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  templateTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  templateMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 4 },
  versionText: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  onlineBadge: { backgroundColor: '#EAFBF6', color: '#098B72' },
  draftBadge: { backgroundColor: '#FFF7F3', color: colors.brand },
  defaultBadge: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#FFF3D6', color: '#A66A00', fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  typeChip: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandSoft, color: colors.brand, fontSize: 12, fontWeight: '600' },
  mutedChip: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  formCard: { gap: spacing.sm },
  typePicker: { gap: spacing.sm },
  typeCard: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 4 },
  typeCardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  typeCardDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  questionCard: { gap: spacing.sm },
  legacyCard: { backgroundColor: '#FAFAFA' },
  questionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  questionType: { color: colors.text, fontSize: 15, fontWeight: '700' },
  legacyText: { color: colors.textTertiary },
  questionIndex: { color: colors.textTertiary, fontSize: 12, marginTop: 3 },
  legacyDesc: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  questionEditor: { gap: spacing.sm },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  questionInput: { minHeight: 48, borderRadius: radius.md, padding: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 15 },
  questionTextarea: { minHeight: 112, textAlignVertical: 'top' },
  previewBox: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: spacing.xs },
  previewText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  addCard: { gap: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  checkBox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkBoxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '700' },
})
