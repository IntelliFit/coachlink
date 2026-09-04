import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'GeneratePlan'>

type FormField = {
  name: string
  type: string
  label: string
  required: boolean
  min?: number
  max?: number
  options?: any[]
  placeholder?: string
}

const domains = [
  {
    key: 'weighted_pullup',
    name: '负重引体',
    description: '专注于引体向上的力量发展，适合想要提升背部和手臂力量的学员',
    difficulty: '中级',
    features: ['自重引体最大次数评估', '1RM负重估算', '肩胛启动技术检查', '6周周期化递进'],
  },
  {
    key: 'weighted_dips',
    name: '负重臂屈伸',
    description: '专注于臂屈伸的力量发展，针对胸部和三头肌的专项训练',
    difficulty: '中级',
    features: ['自重臂屈伸最大次数评估', '1RM负重估算', '肩部活动度检查', '6周周期化递进'],
  },
  {
    key: 'combo',
    name: '引体+臂屈伸组合',
    description: '平衡发展上肢拉力与推力，全面提升上肢力量',
    difficulty: '高级',
    features: ['双重动作能力评估', '推拉力量平衡分析', '4-5周高频训练', '综合力量提升'],
  },
]

const categoryTitles: Record<string, string> = {
  capability: '能力评估',
  technical: '技术要点',
  schedule: '训练安排',
  equipment: '器械配置',
  preference: '个性化偏好',
}

function getDefaultFields(domain: string): FormField[] {
  const baseFields: FormField[] = [
    { name: 'weekly_frequency', type: 'select', label: '每周训练频率', required: true, options: [3, 4] },
    { name: 'session_duration', type: 'select', label: '每次训练时长（分钟）', required: true, options: [45, 60, 90] },
    { name: 'available_days', type: 'multiselect', label: '可训练日', required: true, options: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    { name: 'equipment', type: 'multiselect', label: '可用器械', required: true, options: ['单杠', '双杠', '弹力带', '杠铃片', '哑铃'] },
    { name: 'intensity_preference', type: 'select', label: '强度偏好', required: true, options: ['强度优先', '容量优先', '平衡发展'] },
    { name: 'injuries', type: 'textarea', label: '伤病与限制', required: false, placeholder: '请描述任何相关的伤病历史...' },
    { name: 'specific_goal', type: 'textarea', label: '具体目标', required: true, placeholder: '请详细描述您的训练目标...' },
  ]
  if (domain === 'weighted_pullup') {
    return [
      { name: 'bw_max_reps', type: 'number', label: '自重引体最大连续次数', required: true, min: 0, max: 200 },
      { name: 'est_1rm', type: 'number', label: '估算1RM负重（kg）', required: false, min: 0, max: 100 },
      { name: 'est_3rm', type: 'number', label: '估算3RM负重（kg）', required: false, min: 0, max: 100 },
      { name: 'can_scapular_initiate', type: 'boolean', label: '是否会肩胛启动', required: true },
      { name: 'can_pause_top', type: 'boolean', label: '能否在顶部暂停2秒', required: true },
      { name: 'can_pause_bottom', type: 'boolean', label: '能否在底部暂停2秒', required: true },
      { name: 'grip_preference', type: 'select', label: '握距偏好', required: true, options: ['宽握', '中握', '窄握', '无偏好'] },
      ...baseFields,
    ]
  }
  if (domain === 'weighted_dips') {
    return [
      { name: 'bw_max_reps', type: 'number', label: '自重臂屈伸最大连续次数', required: true, min: 0, max: 200 },
      { name: 'est_1rm', type: 'number', label: '估算1RM负重（kg）', required: false, min: 0, max: 100 },
      { name: 'elbow_issues', type: 'boolean', label: '是否有肘部伤病史', required: true },
      { name: 'shoulder_mobility', type: 'select', label: '肩部活动度', required: true, options: ['良好', '一般', '受限'] },
      ...baseFields,
    ]
  }
  if (domain === 'combo') {
    return [
      { name: 'pullup_bw_max', type: 'number', label: '自重引体最大连续次数', required: true, min: 0, max: 200 },
      { name: 'dips_bw_max', type: 'number', label: '自重臂屈伸最大连续次数', required: true, min: 0, max: 200 },
      { name: 'pullup_1rm', type: 'number', label: '引体估算1RM负重（kg）', required: false, min: 0, max: 100 },
      { name: 'dips_1rm', type: 'number', label: '臂屈伸估算1RM负重（kg）', required: false, min: 0, max: 100 },
      { name: 'priority', type: 'select', label: '优先发展', required: true, options: ['引体向上', '臂屈伸', '平衡发展'] },
      ...baseFields,
    ]
  }
  return baseFields
}

function categorizeFields(formFields: FormField[]): Array<[string, FormField[]]> {
  const categories: Record<string, FormField[]> = {
    capability: formFields.filter((f) => ['bw_max_reps', 'est_1rm', 'est_3rm', 'pullup_bw_max', 'dips_bw_max', 'pullup_1rm', 'dips_1rm'].includes(f.name) || f.name.startsWith('can_') || f.name.includes('_mobility') || f.name.includes('_issues')),
    technical: formFields.filter((f) => f.name.startsWith('grip_') || f.name === 'priority'),
    schedule: formFields.filter((f) => ['weekly_frequency', 'session_duration', 'available_days'].includes(f.name)),
    equipment: formFields.filter((f) => f.name === 'equipment'),
    preference: formFields.filter((f) => ['intensity_preference', 'rest_policy', 'injuries', 'specific_goal'].includes(f.name)),
  }
  return Object.entries(categories).filter(([, fields]) => fields.length > 0)
}

export function GeneratePlanScreen({ navigation, route }: Props) {
  const coachId = route.params?.coachId || ''
  const { isAuthenticated, isGuest } = useAuth()
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loadingFields, setLoadingFields] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || isGuest) {
      Alert.alert('请先登录', '登录后可以使用智能生成计划。', [
        { text: '取消', style: 'cancel', onPress: () => navigation.goBack() },
        { text: '去登录', onPress: () => navigation.navigate('Login') },
      ])
    } else if (!coachId) {
      navigation.replace('MainTabs', { screen: 'CoachesTab' })
    }
  }, [coachId, isAuthenticated, isGuest, navigation])

  useEffect(() => {
    let alive = true
    async function loadFields() {
      if (!selectedDomain || !showForm) return
      setLoadingFields(true)
      setCurrentStep(0)
      setErrors({})
      try {
        const res = await apiClient.request('/api/coach/get-coach-rulepacks', { method: 'POST', body: { coach_id: coachId, domain: selectedDomain }, timeoutMs: 10000 })
        const fields = (res as any)?.data?.form_schema?.fields || (res as any)?.form_schema?.fields || []
        if (alive) setFormFields(Array.isArray(fields) && fields.length ? fields : getDefaultFields(selectedDomain))
      } catch {
        if (alive) setFormFields(getDefaultFields(selectedDomain))
      } finally {
        if (alive) setLoadingFields(false)
      }
    }
    void loadFields()
    return () => { alive = false }
  }, [coachId, selectedDomain, showForm])

  const categories = useMemo(() => categorizeFields(formFields), [formFields])
  const currentCategory = categories[currentStep]

  function update(name: string, value: any) {
    setFormData((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validateStep(fields: FormField[]) {
    const stepErrors: Record<string, string> = {}
    fields.forEach((field) => {
      const value = formData[field.name]
      if (field.required) {
        if (field.type === 'multiselect') {
          if (!value || (Array.isArray(value) && value.length === 0)) stepErrors[field.name] = `${field.label} 不能为空`
        } else if (value === undefined || value === '' || value === null) {
          stepErrors[field.name] = `${field.label} 不能为空`
        }
      }
      if (field.type === 'number' && value !== undefined && value !== '') {
        const n = Number(value)
        if (field.min != null && n < field.min) stepErrors[field.name] = `${field.label} 不能小于 ${field.min}`
        if (field.max != null && n > field.max) stepErrors[field.name] = `${field.label} 不能大于 ${field.max}`
      }
    })
    setErrors((prev) => ({ ...prev, ...stepErrors }))
    return Object.keys(stepErrors).length === 0
  }

  async function submit() {
    if (!selectedDomain || !currentCategory || !validateStep(currentCategory[1])) return
    setSubmitting(true)
    try {
      const res = await apiClient.request('/api/user/submit-onboarding', {
        method: 'POST',
        body: { coachId, answers: { domain: selectedDomain, ...formData }, baseline_video_urls: [] },
        timeoutMs: 15000,
      })
      if ((res as any)?.success === false) throw new Error((res as any)?.message || '提交评估失败')
      navigation.navigate('GeneratePlanWaiting', { coachId, domain: selectedDomain })
    } catch (error: any) {
      Alert.alert('提交评估失败', error?.message || '请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  function nextStep() {
    if (!currentCategory || !validateStep(currentCategory[1])) return
    if (currentStep < categories.length - 1) setCurrentStep((prev) => prev + 1)
    else void submit()
  }

  function renderField(field: FormField) {
    const value = formData[field.name]
    const err = errors[field.name]
    const opts = field.options || []

    if (field.type === 'number') {
      return (
        <View key={field.name} style={styles.field}>
          <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
          <TextInput accessibilityLabel={field.label} accessibilityHint={err || undefined} value={value != null ? String(value) : ''} onChangeText={(text) => update(field.name, text === '' ? undefined : Number(text))} keyboardType="numeric" placeholder={field.placeholder || ''} placeholderTextColor={colors.textMuted} style={[styles.input, err && styles.inputError]} />
          {err ? <Text style={styles.errorText}>{err}</Text> : null}
        </View>
      )
    }

    if (field.type === 'textarea') {
      return (
        <View key={field.name} style={styles.field}>
          <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
          <TextInput accessibilityLabel={field.label} accessibilityHint={err || undefined} value={value != null ? String(value) : ''} onChangeText={(text) => update(field.name, text)} multiline placeholder={field.placeholder || ''} placeholderTextColor={colors.textMuted} style={[styles.textarea, err && styles.inputError]} />
          {err ? <Text style={styles.errorText}>{err}</Text> : null}
        </View>
      )
    }

    if (field.type === 'multiselect') {
      const arr = Array.isArray(value) ? value : []
      return (
        <View key={field.name} style={styles.field}>
          <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
          <View style={styles.optionWrap}>
            {opts.map((opt: string) => {
              const checked = arr.includes(opt)
              return <Pressable key={opt} accessibilityRole="checkbox" accessibilityLabel={`${field.label}：${opt}`} accessibilityState={{ checked }} onPress={() => update(field.name, checked ? arr.filter((item: string) => item !== opt) : [...arr, opt])} style={[styles.optionChip, checked && styles.optionChipActive]}><Text style={[styles.optionText, checked && styles.optionTextActive]}>{opt}</Text></Pressable>
            })}
          </View>
          {err ? <Text style={styles.errorText}>{err}</Text> : null}
        </View>
      )
    }

    if (field.type === 'boolean') {
      return (
        <View key={field.name} style={styles.field}>
          <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
          <View style={styles.booleanRow}>
            {[true, false].map((item) => <Pressable key={String(item)} accessibilityRole="radio" accessibilityLabel={`${field.label}：${item ? '是' : '否'}`} accessibilityState={{ selected: value === item }} onPress={() => update(field.name, item)} style={[styles.booleanButton, value === item && styles.booleanButtonActive]}><Text style={[styles.booleanText, value === item && styles.booleanTextActive]}>{item ? '是' : '否'}</Text></Pressable>)}
          </View>
          {err ? <Text style={styles.errorText}>{err}</Text> : null}
        </View>
      )
    }

    return (
      <View key={field.name} style={styles.field}>
        <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
        <View style={styles.optionWrap}>
          {opts.map((opt: any) => {
            const selected = value === opt
            return <Pressable key={String(opt)} accessibilityRole="radio" accessibilityLabel={`${field.label}：${String(opt)}`} accessibilityState={{ selected }} onPress={() => update(field.name, opt)} style={[styles.optionChip, selected && styles.optionChipActive]}><Text style={[styles.optionText, selected && styles.optionTextActive]}>{String(opt)}</Text></Pressable>
          })}
        </View>
        {err ? <Text style={styles.errorText}>{err}</Text> : null}
      </View>
    )
  }

  if (showForm && selectedDomain) {
    if (loadingFields || !currentCategory) {
      return <Page><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>加载评估表单...</Text></Page>
    }
    const [categoryName, categoryFields] = currentCategory
    return (
      <Page>
        <View style={styles.formHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回训练域选择" onPress={() => setShowForm(false)} style={styles.backLink}><IconFont name="icon-back" color={colors.brand} size={16} /><Text style={styles.backText}>返回选择</Text></Pressable>
          <Text style={styles.stepText}>步骤 {currentStep + 1} / {categories.length}</Text>
        </View>
        <SectionCard title={categoryTitles[categoryName] || categoryName} description="请根据您的实际情况填写。">
          {categoryFields.map(renderField)}
        </SectionCard>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="上一步" accessibilityState={{ disabled: currentStep === 0 }} disabled={currentStep === 0} onPress={() => setCurrentStep((prev) => Math.max(0, prev - 1))} style={[styles.secondaryButton, currentStep === 0 && styles.disabledButton]}><Text style={styles.secondaryButtonText}>上一步</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={currentStep === categories.length - 1 ? '生成计划' : '下一步'} accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting} onPress={nextStep} style={[styles.primaryButton, submitting && styles.disabledButton]}><Text style={styles.primaryButtonText}>{submitting ? '提交中...' : currentStep === categories.length - 1 ? '生成计划' : '下一步'}</Text></Pressable>
        </View>
      </Page>
    )
  }

  return (
    <Page>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><IconFont name="icon-a-Trainingplan" color={colors.brand} size={30} /></View>
        <Text style={styles.heroTitle}>选择您的训练域</Text>
        <Text style={styles.heroDesc}>根据您想要重点发展的动作选择相应的训练域。</Text>
      </View>
      <View style={styles.domainList}>
        {domains.map((domain) => {
          const selected = selectedDomain === domain.key
          return (
            <Pressable key={domain.key} accessibilityRole="radio" accessibilityLabel={`训练域：${domain.name}`} accessibilityHint={domain.description} accessibilityState={{ selected }} onPress={() => setSelectedDomain(domain.key)} style={[styles.domainCard, selected && styles.domainCardSelected]}>
              <View style={styles.domainHead}>
                <Text style={styles.domainName}>{domain.name}</Text>
                <Text style={styles.diffPill}>{domain.difficulty}</Text>
              </View>
              <Text style={styles.domainDesc}>{domain.description}</Text>
              <View style={styles.featureList}>
                {domain.features.slice(0, 3).map((feature) => <View key={feature} style={styles.featureRow}><IconFont name="icon-jhk" color={colors.brand} size={13} /><Text style={styles.featureText}>{feature}</Text></View>)}
              </View>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="下一步，填写计划评估" accessibilityState={{ disabled: !selectedDomain }} disabled={!selectedDomain} onPress={() => setShowForm(true)} style={[styles.primaryButton, !selectedDomain && styles.disabledButton]}><Text style={styles.primaryButtonText}>下一步</Text></Pressable>
      </View>
    </Page>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs, borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heroIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  heroTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  heroDesc: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  domainList: { gap: spacing.sm },
  domainCard: { gap: spacing.sm, borderRadius: radius.xl, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  domainCardSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  domainHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  domainName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  diffPill: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, fontSize: 12, fontWeight: '900', backgroundColor: '#FFFFFF' },
  domainDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  featureList: { gap: spacing.xs },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
  stepText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  field: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 14, fontWeight: '800' },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  textarea: { minHeight: 104, borderRadius: radius.md, padding: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top' },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 12, lineHeight: 18 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionChip: { minHeight: 48, justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  optionChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  optionTextActive: { color: '#FFFFFF' },
  booleanRow: { flexDirection: 'row', gap: spacing.xs },
  booleanButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  booleanButtonActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  booleanText: { color: colors.textSecondary, fontWeight: '800' },
  booleanTextActive: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primaryButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  loadingText: { color: colors.textSecondary, textAlign: 'center' },
})
