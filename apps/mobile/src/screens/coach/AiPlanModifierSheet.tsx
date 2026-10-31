import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { fetchWithTimeout, getStoredToken } from '../../api'
import { API_BASE_URL } from '../../config'
import { colors, radius, spacing } from '../../theme'
import { buildBatchOperationBody, extractBatchOperationPreview, parseBatchOperationMessages } from './aiPlanModifier'

/** AI 修改器：先生成预览，确认后只应用到当前编辑器，仍需保存计划。对应小程序学员计划页「AI 修改器」。 */
export function AiPlanModifierSheet(props: {
  visible: boolean
  trainingDays: unknown[]
  subscriptionId: string
  studentId?: string
  onClose: () => void
  onApply: (days: any[]) => void
}) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ days: any[]; summary: string } | null>(null)

  useEffect(() => {
    if (!props.visible) return
    setError('')
    setPreview(null)
  }, [props.visible])

  async function run() {
    const text = instruction.trim()
    if (!text) {
      setError('请输入要让 AI 修改计划的要求')
      return
    }
    if (!props.trainingDays.length) {
      setError('当前计划为空，无法进行 AI 修改')
      return
    }
    setLoading(true)
    setError('')
    setPreview(null)
    try {
      const token = await getStoredToken()
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/plan-lib/batch-operation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(buildBatchOperationBody({ trainingDays: props.trainingDays, instruction: text, subscriptionId: props.subscriptionId, subjectUserId: props.studentId })),
      }, 120_000)
      const body = await response.text()
      if (!response.ok) {
        let message = `AI 修改器请求失败: ${response.status}`
        try { message = JSON.parse(body)?.message || message } catch { /* SSE 文本 */ }
        throw new Error(message)
      }
      const result = extractBatchOperationPreview(parseBatchOperationMessages(body))
      setPreview({ days: result.updatedTrainingDays, summary: result.summary })
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'AI 修改失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const close = () => { if (!loading) props.onClose() }

  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭" style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <Text style={styles.title}>AI 修改器</Text>
        <Text style={styles.hint}>先生成预览，确认后只应用到当前编辑器，仍需点击保存计划。</Text>
        <TextInput
          accessibilityLabel="修改要求"
          value={instruction}
          onChangeText={(value) => { setInstruction(value); if (error) setError('') }}
          maxLength={2000}
          multiline
          textAlignVertical="top"
          placeholder="例如：根据最近反馈，把第 2 周引体强度下调到 8RM，并把总量减少一组。"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {preview ? (
          <View style={styles.preview}>
            <Text style={styles.previewTitle}>预览结果</Text>
            <Text style={styles.previewText}>{preview.summary}</Text>
            <Text style={styles.previewMeta}>{preview.days.length} 天计划已准备应用</Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消" disabled={loading} onPress={close} style={[styles.button, styles.secondary]}>
            <Text style={styles.secondaryText}>取消</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={preview ? '重新生成' : '生成预览'} accessibilityState={{ busy: loading, disabled: loading }} disabled={loading} onPress={() => void run()} style={[styles.button, preview ? styles.secondary : styles.primary, loading && styles.disabled]}>
            {loading ? <ActivityIndicator color={preview ? colors.brand : '#FFFFFF'} /> : <Text style={preview ? styles.secondaryText : styles.primaryText}>{preview ? '重新生成' : '生成预览'}</Text>}
          </Pressable>
          {preview ? (
            <Pressable accessibilityRole="button" accessibilityLabel="应用到编辑器" onPress={() => props.onApply(preview.days)} style={[styles.button, styles.primary]}>
              <Text style={styles.primaryText}>应用到编辑器</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)' },
  sheet: { gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  input: { minHeight: 120, padding: spacing.sm, borderRadius: radius.md, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13 },
  preview: { gap: 4, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  previewTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  previewText: { color: colors.text, fontSize: 13, lineHeight: 20 },
  previewMeta: { color: colors.textSecondary, fontSize: 12 },
  footer: { flexDirection: 'row', gap: spacing.xs },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  primary: { backgroundColor: colors.brand },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
})
