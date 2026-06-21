import { useEffect, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { createCoachPaymentWaitingParams } from './coachPayment'

type Props = NativeStackScreenProps<RootStackParamList, 'CoachQuestionnaire'>

type TrainingItem = {
  id?: string
  type: string
  question?: string
  options?: any[]
  userSelections?: any[]
  userSelection?: any
  userInputs?: Record<string, any>
  selectionMode?: 'single' | 'multiple'
  allowOther?: boolean
  userOtherText?: string
}

function getOptionLabel(option: any) {
  if (typeof option === 'string' || typeof option === 'number') return String(option)
  if (option && typeof option === 'object') return String(option.label ?? option.text ?? option.value ?? option.name ?? '')
  return ''
}

function normalizeQuestions(questions: TrainingItem[], existingAnswers?: TrainingItem[]) {
  if (!Array.isArray(existingAnswers) || existingAnswers.length === 0) return questions.map((item) => ({ ...item }))
  return questions.map((item) => {
    const existing = existingAnswers.find((answer) => (answer.id && item.id && answer.id === item.id) || (answer.type === item.type && answer.question === item.question))
    return existing ? { ...item, ...existing } : { ...item }
  })
}

function isQuestionAnswered(item: TrainingItem) {
  if (item.type === 'tags') return Array.isArray(item.userSelections) && item.userSelections.length > 0
  if (item.type === 'option') {
    const mode = item.selectionMode === 'multiple' ? 'multiple' : 'single'
    if (mode === 'multiple') {
      const selected = Array.isArray(item.userSelections) ? item.userSelections : []
      if (selected.length === 0) return false
      if (item.allowOther && selected.includes(-1)) return String(item.userOtherText || '').trim().length > 0
      return true
    }
    if (item.userSelection === undefined || item.userSelection === null) return false
    if (item.allowOther && item.userSelection === -1) return String(item.userOtherText || '').trim().length > 0
    return true
  }
  if (item.type === 'times') return item.userSelection !== undefined && item.userSelection !== null && String(item.userSelection).trim() !== ''
  if (item.type === 'rm') {
    const inputs = item.userInputs || {}
    const keys = Object.keys(inputs)
    if (keys.length === 0) return false
    return keys.every((key) => String(inputs[key] ?? '').trim() !== '')
  }
  return item.userSelection !== undefined && item.userSelection !== null && String(item.userSelection).trim() !== ''
}

function pickArray(data: any, keys: string[]) {
  for (const key of keys) {
    const value = data?.[key] ?? data?.data?.[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function tierToNumber(tier?: string) {
  if (tier === 'basic') return 1
  if (tier === 'standard') return 2
  return 3
}

export function CoachQuestionnaireScreen({ navigation, route }: Props) {
  const params = route.params || {}
  const mode = params.mode === 'edit' ? 'edit' : 'prepay'
  const [answers, setAnswers] = useState<TrainingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const coachId = params.coachId || ''
    if (!coachId) {
      setError('缺少教练信息')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const payload = await apiClient.request<any>('/api/coach/get-questionnaires', { method: 'POST', body: { coachId }, timeoutMs: 10000 })
      const list = pickArray(payload, ['questionnaires'])
      if (list.length === 0) {
        setError('该教练暂未配置问卷')
        setAnswers([])
      } else {
        setAnswers(normalizeQuestions(list, params.existingAnswers as TrainingItem[] | undefined))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取问卷失败')
    } finally {
      setLoading(false)
    }
  }

  function updateAnswer(index: number, patch: Partial<TrainingItem>) {
    setAnswers((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function submit() {
    if (submitting) return
    const incompleteIndexes = answers.map((item, index) => (isQuestionAnswered(item) ? -1 : index + 1)).filter((index) => index > 0)
    if (incompleteIndexes.length > 0) {
      const preview = incompleteIndexes.slice(0, 3).map((index) => `第${index}题`).join('、')
      Alert.alert('问卷未完成', `${preview}${incompleteIndexes.length > 3 ? '等问题' : ''}还未填写完整`)
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'edit') {
        if (!params.subscriptionId) throw new Error('缺少订阅信息，请返回重试')
        await apiClient.request('/api/subscription/update-subscription', { method: 'POST', timeoutMs: 15000, body: { id: params.subscriptionId, subscribe_data: answers } })
        Alert.alert('问卷提交成功', '你的训练偏好和当前状态已更新。', [{ text: '知道了', onPress: () => navigation.goBack() }])
        return
      }

      if (!params.coachId || !params.productId || !params.productTier || !params.months || !params.price) {
        throw new Error('套餐信息已失效，请重新选择')
      }

      let subscriptionId = params.subscriptionId || ''
      if (subscriptionId) {
        const payload = await apiClient.request<any>('/api/subscription/update-subscription', {
          method: 'POST',
          timeoutMs: 15000,
          body: {
            id: subscriptionId,
            subscribe_data: answers,
            product_id: params.productId,
            product_name: params.productName,
            product_tier: params.productTier,
            monthly_price: Math.round(Number(params.price) * 100),
            subscribed_weeks: Number(params.months) * 4,
          },
        })
        subscriptionId = payload?.subscription?.id || subscriptionId
      } else {
        const payload = await apiClient.request<any>('/api/subscription/create-subscription', {
          method: 'POST',
          timeoutMs: 15000,
          body: {
            coachId: params.coachId,
            tier: tierToNumber(params.productTier),
            monthlyPrice: Number(params.price),
            status: 'inactive',
            subscribeData: answers,
            productId: params.productId,
            productName: params.productName,
            productTier: params.productTier,
            subscribedWeeks: Number(params.months) * 4,
          },
        })
        subscriptionId = payload?.subscription?.id || ''
      }

      const waitingParams = await createCoachPaymentWaitingParams({
        coachId: params.coachId,
        coachName: params.coachName,
        subscriptionId,
        amount: Number(params.price),
      })
      navigation.navigate('PaymentWaiting', waitingParams)
    } catch (err) {
      Alert.alert('提交失败', err instanceof Error ? err.message : '请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    void load()
  }, [params.coachId])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.badge}>{mode === 'edit' ? '更新资料' : '订阅前确认'}</Text>
          <Text style={styles.title}>{params.coachName ? `${params.coachName} 的训练需求问卷` : '训练需求问卷'}</Text>
          <Text style={styles.subtitle}>{mode === 'edit' ? '更新你的训练偏好和当前状态，方便教练继续调整计划。' : '先完成这份问卷，提交后会进入收银台完成支付。'}</Text>
          {mode === 'prepay' ? <View style={styles.productPill}><Text style={styles.productText}>{params.productName || '所选套餐'}</Text><Text style={styles.productText}>{params.months || 0} 个月 · ¥{Number(params.price || 0).toFixed(2)}</Text></View> : null}
        </View>

        {loading ? <ActivityIndicator color={colors.brand} /> : null}
        {error && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
          </View>
        ) : null}

        {!loading && !error ? (
          <View style={styles.form}>
            {answers.map((item, index) => <QuestionItem key={item.id || `${item.type}-${index}`} item={item} index={index} onChange={(patch) => updateAnswer(index, patch)} />)}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => navigation.goBack()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>返回</Text></Pressable>
        <Pressable disabled={loading || answers.length === 0 || submitting} onPress={submit} style={[styles.primaryButton, (loading || answers.length === 0 || submitting) && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{submitting ? '提交中...' : mode === 'edit' ? '确认提交' : '确认并去支付'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function QuestionItem({ item, index, onChange }: { item: TrainingItem; index: number; onChange: (patch: Partial<TrainingItem>) => void }) {
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionLabel}>Q{index + 1}. {item.question || `问题 ${index + 1}`}</Text>
      {item.type === 'tags' ? <MultiLabelOptions item={item} onChange={onChange} valueMode="label" /> : null}
      {item.type === 'times' ? <SingleValueOptions item={item} onChange={onChange} fallback={[1, 2, 3, 4, 5, 6, 7]} /> : null}
      {item.type === 'rm' ? <RmInputs item={item} onChange={onChange} /> : null}
      {item.type === 'option' ? <OptionQuestion item={item} onChange={onChange} /> : null}
      {item.type === 'text' || !['tags', 'times', 'rm', 'option'].includes(item.type) ? (
        <TextInput value={String(item.userSelection || '')} onChangeText={(value) => onChange({ userSelection: value })} placeholder="请输入答案" placeholderTextColor={colors.textMuted} style={styles.textInput} />
      ) : null}
    </View>
  )
}

function MultiLabelOptions({ item, onChange, valueMode }: { item: TrainingItem; onChange: (patch: Partial<TrainingItem>) => void; valueMode: 'label' | 'index' }) {
  const selected = Array.isArray(item.userSelections) ? item.userSelections : []
  return (
    <View style={styles.optionWrap}>
      {(item.options || []).map((option, optionIndex) => {
        const label = getOptionLabel(option)
        const value = valueMode === 'label' ? label : optionIndex
        const active = selected.includes(value)
        return <OptionChip key={`${label}-${optionIndex}`} label={label} active={active} onPress={() => onChange({ userSelections: active ? selected.filter((entry) => entry !== value) : [...selected, value] })} />
      })}
    </View>
  )
}

function SingleValueOptions({ item, onChange, fallback }: { item: TrainingItem; onChange: (patch: Partial<TrainingItem>) => void; fallback?: any[] }) {
  const options = item.options?.length ? item.options : fallback || []
  return (
    <View style={styles.optionWrap}>
      {options.map((option, optionIndex) => {
        const value = typeof option === 'number' ? option : getOptionLabel(option)
        return <OptionChip key={`${value}-${optionIndex}`} label={String(value)} active={item.userSelection === value} onPress={() => onChange({ userSelection: value })} />
      })}
    </View>
  )
}

function OptionQuestion({ item, onChange }: { item: TrainingItem; onChange: (patch: Partial<TrainingItem>) => void }) {
  const multiple = item.selectionMode === 'multiple'
  const selected = Array.isArray(item.userSelections) ? item.userSelections : []
  const otherActive = item.allowOther && (multiple ? selected.includes(-1) : item.userSelection === -1)
  return (
    <View style={styles.optionWrap}>
      {(item.options || []).map((option, optionIndex) => {
        const label = getOptionLabel(option)
        const active = multiple ? selected.includes(optionIndex) : item.userSelection === optionIndex
        return <OptionChip key={`${label}-${optionIndex}`} label={label} active={active} onPress={() => multiple ? onChange({ userSelections: active ? selected.filter((entry) => entry !== optionIndex) : [...selected, optionIndex] }) : onChange({ userSelection: optionIndex })} />
      })}
      {item.allowOther ? <OptionChip label="其他" active={Boolean(otherActive)} onPress={() => multiple ? onChange({ userSelections: otherActive ? selected.filter((entry) => entry !== -1) : [...selected, -1], userOtherText: otherActive ? '' : item.userOtherText }) : onChange({ userSelection: -1 })} /> : null}
      {otherActive ? <TextInput value={item.userOtherText || ''} onChangeText={(value) => onChange({ userOtherText: value })} placeholder="请输入补充内容" placeholderTextColor={colors.textMuted} style={styles.textInput} /> : null}
    </View>
  )
}

function RmInputs({ item, onChange }: { item: TrainingItem; onChange: (patch: Partial<TrainingItem>) => void }) {
  const inputs = item.userInputs || {}
  const keys = Object.keys(inputs)
  return (
    <View style={styles.rmWrap}>
      <Text style={styles.hint}>请输入各动作的 RM 重量（kg）</Text>
      {keys.length === 0 ? <Text style={styles.hint}>暂无动作项</Text> : null}
      {keys.map((key) => (
        <View key={key} style={styles.rmRow}>
          <Text style={styles.rmLabel}>{key}</Text>
          <TextInput value={String(inputs[key] ?? '')} onChangeText={(value) => onChange({ userInputs: { ...inputs, [key]: value } })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={styles.rmInput} />
        </View>
      ))}
    </View>
  )
}

function OptionChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.optionChip, active && styles.optionChipActive]}>
      <IconFont name={active ? 'icon-goumaijilu' : 'icon-right-arrow'} color={active ? '#FFFFFF' : colors.textMuted} size={12} />
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 128, gap: spacing.sm },
  hero: { borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  badge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '900' },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 32 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 22 },
  productPill: { marginTop: spacing.xs, borderRadius: radius.lg, padding: spacing.sm, gap: 4, backgroundColor: colors.surfaceMuted },
  productText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  emptyCard: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  form: { gap: spacing.sm },
  questionCard: { borderRadius: radius.lg, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  questionLabel: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: '900' },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionChip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  optionChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { color: colors.textSecondary, fontSize: 14, fontWeight: '800' },
  optionTextActive: { color: '#FFFFFF' },
  textInput: { minHeight: 48, flex: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  rmWrap: { gap: spacing.xs },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  rmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rmLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  rmInput: { width: 112, minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  footer: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.sm, flexDirection: 'row', gap: spacing.sm, borderRadius: radius.xl, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  secondaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  primaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.48 },
})
