import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { Card, SolidButton, errorMessage, safeRequest } from '../me/MeShared'
import {
  DEFAULT_TIMES_OPTIONS,
  finalizeQuestionnaireDraft,
  isOptionSelected,
  mergeQuestionnaireAnswers,
  normalizeQuestionnaireData,
  questionnaireAnswerText,
  questionnaireQuestionText,
  rmInputKeys,
  toggleTagSelection,
  type QuestionnaireItem,
} from './questionnaireAnswers'

/** 学员入营问卷：查看全部答案，教练可编辑后保存。对应小程序 coach/students/detail「入营问卷」。 */
export function CoachStudentQuestionnaireCard({ subscriptionId, coachId, subscribeData, onSaved }: {
  subscriptionId: string
  coachId: string
  subscribeData: unknown
  onSaved: (next: QuestionnaireItem[]) => void
}) {
  const answers = useMemo(() => normalizeQuestionnaireData(subscribeData), [subscribeData])
  const [draft, setDraft] = useState<QuestionnaireItem[]>([])
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditing(false)
  }, [subscriptionId])

  async function startEdit() {
    if (loading) return
    setLoading(true)
    try {
      let next = answers
      if (coachId) {
        const data = await safeRequest<{ questionnaires?: unknown }>('/api/coach/get-questionnaires', { body: { coachId } })
        const questions = normalizeQuestionnaireData(data?.questionnaires)
        if (questions.length > 0) next = mergeQuestionnaireAnswers(questions, answers)
      }
      if (next.length === 0) {
        Alert.alert('暂无可编辑问卷')
        return
      }
      setDraft(next)
      setEditing(true)
    } catch (error) {
      // 读不到题目时不进入编辑，避免只拿到部分题目后覆盖答案
      Alert.alert('加载问卷失败', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      const questionnaires = finalizeQuestionnaireDraft(draft)
      await safeRequest('/api/subscription/update-questionnaire', { body: { id: subscriptionId, questionnaires } })
      onSaved(questionnaires)
      setEditing(false)
      Alert.alert('问卷已更新')
    } catch (error) {
      Alert.alert('保存问卷失败', errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const patchItem = (index: number, updater: (item: QuestionnaireItem) => QuestionnaireItem) => {
    setDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)))
  }

  const items = editing ? draft : answers

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>入营问卷</Text>
        {editing ? (
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="取消编辑问卷" disabled={saving} onPress={() => setEditing(false)} style={styles.headerAction}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="保存问卷" accessibilityState={{ busy: saving, disabled: saving }} disabled={saving} onPress={() => void save()} style={styles.headerAction}>
              <Text style={styles.linkText}>{saving ? '保存中…' : '保存'}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="编辑问卷" accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={() => void startEdit()} style={styles.headerAction}>
            <Text style={styles.linkText}>{loading ? '加载中…' : '编辑'}</Text>
          </Pressable>
        )}
      </View>
      {items.length === 0 ? <Text style={styles.empty}>暂无问卷数据</Text> : null}
      {items.map((item, index) => (
        <View key={`${item.id || item.type || 'question'}-${index}`} style={styles.item}>
          <Text style={styles.question}>{String(index + 1).padStart(2, '0')} · {questionnaireQuestionText(item)}</Text>
          {editing ? <QuestionEditor item={item} onChange={(updater) => patchItem(index, updater)} /> : <Text style={styles.answer}>{questionnaireAnswerText(item)}</Text>}
        </View>
      ))}
      {editing ? <SolidButton label="保存问卷" loading={saving} onPress={() => void save()} /> : null}
    </Card>
  )
}

function QuestionEditor({ item, onChange }: { item: QuestionnaireItem; onChange: (updater: (item: QuestionnaireItem) => QuestionnaireItem) => void }) {
  const options = Array.isArray(item.options) ? item.options.map((option) => String(option)) : []

  if (item.type === 'tags') {
    const selections = Array.isArray(item.userSelections) ? item.userSelections : []
    if (options.length === 0) {
      return (
        <TextInput
          accessibilityLabel={questionnaireQuestionText(item)}
          value={selections.join('、')}
          onChangeText={(text) => onChange((current) => ({ ...current, userSelections: text.split(/[、,，]/).map((value) => value.trim()).filter(Boolean) }))}
          placeholder="用顿号分隔多个选项"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      )
    }
    return (
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip key={option} label={option} active={selections.includes(option)} onPress={() => onChange((current) => toggleTagSelection(current, option))} />
        ))}
      </View>
    )
  }

  if (item.type === 'times') {
    const timesOptions = options.length > 0 ? options : DEFAULT_TIMES_OPTIONS
    return (
      <View style={styles.chips}>
        {timesOptions.map((option) => (
          <Chip key={option} label={`${option}次`} active={String(item.userSelection ?? '') === option} onPress={() => onChange((current) => ({ ...current, userSelection: Number(option) }))} />
        ))}
      </View>
    )
  }

  if (item.type === 'option') {
    return (
      <View style={styles.chips}>
        {options.map((option, optionIndex) => (
          <Chip key={option} label={option} active={isOptionSelected(item, option, optionIndex)} onPress={() => onChange((current) => ({ ...current, userSelection: optionIndex }))} />
        ))}
      </View>
    )
  }

  if (item.type === 'rm') {
    const keys = rmInputKeys(item)
    if (keys.length === 0) return <Text style={styles.empty}>暂无 1RM 动作项</Text>
    return (
      <View style={styles.rmList}>
        {keys.map((key) => {
          const raw = (item.userInputs || {})[key]
          return (
            <View key={key} style={styles.rmRow}>
              <Text style={styles.rmName} numberOfLines={2}>{key}</Text>
              <TextInput
                accessibilityLabel={`${key} 的 1RM（kg）`}
                value={raw === undefined || raw === null || raw === 0 ? '' : String(raw)}
                onChangeText={(text) => onChange((current) => ({ ...current, userInputs: { ...(current.userInputs || {}), [key]: text.replace(',', '.') } }))}
                keyboardType="decimal-pad"
                placeholder="kg"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.rmInput]}
              />
            </View>
          )
        })}
      </View>
    )
  }

  return (
    <TextInput
      accessibilityLabel={questionnaireQuestionText(item)}
      value={String(item.userSelection ?? item.answer ?? '')}
      onChangeText={(text) => onChange((current) => ({ ...current, userSelection: text, answer: text }))}
      maxLength={1000}
      multiline
      textAlignVertical="top"
      placeholder="填写问卷答案"
      placeholderTextColor={colors.textMuted}
      style={[styles.input, styles.textarea]}
    />
  )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerAction: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  linkText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  cancelText: { color: colors.textSecondary, fontSize: 14 },
  empty: { color: colors.textSecondary, fontSize: 13 },
  item: { gap: spacing.xs },
  question: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  answer: { color: colors.text, fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: controlHeight.chip, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, ...typography.meta },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  input: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surfaceMuted, fontSize: 14 },
  textarea: { minHeight: 88, paddingVertical: spacing.sm },
  rmList: { gap: spacing.xs },
  rmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rmName: { flex: 1, color: colors.text, fontSize: 14 },
  rmInput: { width: 96 },
})
