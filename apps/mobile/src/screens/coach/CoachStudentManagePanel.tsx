import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'
import { Card, SolidButton, errorMessage, safeRequest } from '../me/MeShared'

type CoachReview = {
  id: string
  review_text?: string | null
  created_at?: string | null
}

const FEEDBACK_DIFFICULTY: Record<number, string> = { 1: '太轻松', 2: '轻松', 3: '刚好', 4: '有点难', 5: '太难了' }

/** 与小程序 buildFeedbackDraft 一致：教练回复反馈时预填一段带上下文的消息。 */
export function buildFeedbackDraft(feedback: { day_index?: unknown; difficulty_rating?: unknown; content?: unknown }) {
  const day = Number(feedback.day_index)
  const dayText = Number.isFinite(day) && day > 0 ? `第${Math.floor(day)}天` : '当天训练'
  const rating = Number(feedback.difficulty_rating)
  const difficultyText = rating ? `难度反馈：${FEEDBACK_DIFFICULTY[rating] || `${rating}/5`}` : ''
  const contentText = String(feedback.content || '').trim()
  return [`我看到了你 ${dayText} 的训练反馈。`, difficultyText, contentText ? `你写到：${contentText}` : '']
    .filter(Boolean)
    .join('\n')
    .slice(0, 180)
}

function dateText(value?: string | null) {
  if (!value) return ''
  return String(value).replace('T', ' ').slice(0, 16)
}

type Props = {
  subscriptionId: string
  studentId: string
  coachId: string
  planInstanceId?: string | null
  planName?: string | null
  onPlanCleared: () => void
}

/** 学员档案里的教练操作：教练记录（学员个人资料可见）和清空当前计划。 */
export function CoachStudentManagePanel({ subscriptionId, studentId, coachId, planInstanceId, planName, onPlanCleared }: Props) {
  const [reviews, setReviews] = useState<CoachReview[]>([])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const loadReviews = useCallback(async () => {
    if (!subscriptionId) return
    const data = await safeRequest<{ reviews?: CoachReview[] }>('/api/subscription/get-coach-reviews', { body: { subscriptionId } }).catch(() => null)
    setReviews(Array.isArray(data?.reviews) ? data.reviews : [])
  }, [subscriptionId])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  async function saveReview() {
    const reviewText = draft.trim()
    if (!reviewText || !subscriptionId || !studentId || !coachId) return
    setSaving(true)
    try {
      await safeRequest('/api/subscription/create-coach-reviews', { body: { subscriptionId, studentId, coachId, reviewText } })
      setDraft('')
      await loadReviews()
    } catch (saveError) {
      Alert.alert('保存失败', errorMessage(saveError, '请稍后重试'))
    } finally {
      setSaving(false)
    }
  }

  function deleteReview(review: CoachReview) {
    Alert.alert('删除记录', '删除后无法恢复，确定删除这条记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void safeRequest('/api/subscription/delete-coach-reviews', { body: { reviewId: review.id } })
            .then(() => setReviews((current) => current.filter((item) => item.id !== review.id)))
            .catch((deleteError) => Alert.alert('删除失败', errorMessage(deleteError)))
        },
      },
    ])
  }

  async function clearPlan(mode: 'archive' | 'delete') {
    if (!planInstanceId || clearing) return
    setClearing(true)
    try {
      if (mode === 'archive') {
        await safeRequest('/api/plan-lib/archive-instance', { body: { instanceId: planInstanceId } })
      } else {
        await safeRequest('/api/plan-lib/delete-instance', { body: { id: planInstanceId } })
      }
      Alert.alert(mode === 'archive' ? '当前计划已归档' : '当前计划已删除', '学员已回到未配置计划状态，可以重新分配计划。')
      onPlanCleared()
    } catch (clearError) {
      Alert.alert('清空计划失败', errorMessage(clearError, '请稍后重试'))
    } finally {
      setClearing(false)
    }
  }

  function confirmClearPlan() {
    Alert.alert('清空当前计划', `「${planName || '当前计划'}」将从学员今日训练中移除。`, [
      { text: '取消', style: 'cancel' },
      { text: '归档保留（保留记录）', onPress: () => void clearPlan('archive') },
      {
        text: '彻底删除',
        style: 'destructive',
        onPress: () => Alert.alert('确认彻底删除？', '适合明显错误的 AI 生成计划。删除后无法恢复。', [
          { text: '取消', style: 'cancel' },
          { text: '彻底删除', style: 'destructive', onPress: () => void clearPlan('delete') },
        ]),
      },
    ])
  }

  return (
    <>
      <Card style={styles.card}>
        <Text style={styles.title}>教练私密记录</Text>
        <Text style={styles.subtitle}>记录学员状态、伤病和沟通要点。注意：学员在个人资料的「教练评语」里也能看到这些记录。</Text>
        <TextInput
          accessibilityLabel="新增记录"
          value={draft}
          onChangeText={setDraft}
          placeholder="例如：右膝旧伤，深蹲控制在 90 度以内"
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
        />
        <SolidButton label="新增记录" loading={saving} disabled={!draft.trim()} onPress={() => void saveReview()} />
        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewRow}>
            <View style={styles.reviewBody}>
              <Text style={styles.reviewText}>{review.review_text || '（空）'}</Text>
              <Text style={styles.reviewDate}>{dateText(review.created_at)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="删除这条记录" onPress={() => deleteReview(review)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>删除</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {planInstanceId ? (
        <Card style={styles.card}>
          <Text style={styles.title}>计划管理</Text>
          <Text style={styles.subtitle}>计划明显有误时可以清空：归档会保留已有训练记录，删除适合错误的 AI 生成结果。</Text>
          <SolidButton label={clearing ? '处理中…' : '清空当前计划'} variant="danger" loading={clearing} onPress={confirmClearPlan} />
        </Card>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    minHeight: 88,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  reviewBody: {
    flex: 1,
    gap: 2,
  },
  reviewText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  reviewDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  deleteButton: {
    minHeight: 40,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
})
