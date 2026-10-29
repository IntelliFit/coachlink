import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { apiClient } from '../../api'
import { colors, controlHeight, radius, spacing, typography } from '../../theme'
import { pickData } from './trainingModel'
import {
  LIGHT_TASK_LABELS,
  buildLightTaskCustomData,
  initialLightTaskForm,
  lightTaskType,
  type LightTaskForm,
} from './lightTaskModel'

type Props = {
  visible: boolean
  instanceId: string
  dayIndex: number
  /** 当天已有的执行记录；没有时先创建（与小程序一致）。 */
  executionId?: string | null
  onClose: () => void
  onAdded: () => void | Promise<void>
}

/** 今日训练「添加轻任务」：从动作库选饮食 / 有氧 / 习惯，再填写当天的具体安排。 */
export function LightTaskSheet({ visible, instanceId, dayIndex, executionId, onClose, onAdded }: Props) {
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<any | null>(null)
  const [form, setForm] = useState<LightTaskForm | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!visible) {
      setPending(null)
      setForm(null)
      return
    }
    if (actions.length > 0) return
    setLoading(true)
    apiClient.request<any>('/api/student/action-lib/list-actions', { method: 'POST', body: { page: 1, limit: 200 }, timeoutMs: 12000 })
      .then((data) => setActions((Array.isArray(data?.actions) ? data.actions : []).filter((action: any) => lightTaskType(action))))
      .catch((error) => Alert.alert('动作库加载失败', error instanceof Error ? error.message : '请稍后重试'))
      .finally(() => setLoading(false))
  }, [actions.length, visible])

  const patch = (next: Partial<LightTaskForm>) => setForm((current) => (current ? { ...current, ...next } : current))
  const type = lightTaskType(pending)

  async function submit() {
    if (!pending || !form || !type || saving) return
    setSaving(true)
    try {
      let targetExecutionId = executionId || ''
      if (!targetExecutionId) {
        const started = pickData(await apiClient.request('/api/execution/start', { method: 'POST', body: { instanceId, dayIndex }, timeoutMs: 15000 })) || {}
        targetExecutionId = String(started?.id || started?.execution?.id || started?.executionId || '')
      }
      if (!targetExecutionId) throw new Error('无法创建当天执行记录')
      await apiClient.request('/api/execution/extra-content/add-extra-exercise', {
        method: 'POST',
        body: {
          executionId: targetExecutionId,
          actionId: pending.id,
          actionName: pending.name,
          sets: [{ weight: null, reps: null }],
          suggestedTime: form.suggestedTime.trim() || undefined,
          notes: form.notes.trim() || undefined,
          customData: buildLightTaskCustomData(type, form, String(pending.name || '')),
        },
        timeoutMs: 15000,
      })
      onClose()
      await Promise.resolve(onAdded()).catch(() => undefined)
    } catch (error) {
      Alert.alert('新增失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.mask}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭" style={StyleSheet.absoluteFill} onPress={() => !saving && onClose()} />
        <View style={styles.sheet}>
          <Text style={styles.title}>{pending ? `添加${LIGHT_TASK_LABELS[type || 'HABIT']}：${pending.name}` : '添加轻任务'}</Text>
          {!pending ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {loading ? <ActivityIndicator color={colors.brand} /> : null}
              {!loading && actions.length === 0 ? <Text style={styles.empty}>动作库里还没有饮食、有氧或习惯类动作，可以先在动作库添加。</Text> : null}
              {actions.map((action) => {
                const actionType = lightTaskType(action)
                return (
                  <Pressable
                    key={action.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setPending(action)
                      setForm(initialLightTaskForm(action))
                    }}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={styles.rowTitle}>{action.name}</Text>
                    <Text style={styles.rowTag}>{actionType ? LIGHT_TASK_LABELS[actionType] : ''}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : form ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
              {type === 'DIET' ? <Field label="饮食内容" value={form.dietContent} onChange={(dietContent) => patch({ dietContent })} placeholder="例如：午餐 150g 鸡胸 + 一碗米饭" /> : null}
              {type === 'CARDIO' ? (
                <View style={styles.grid}>
                  <Field compact label="距离(km)" value={form.cardioDistanceKm} keyboardType="decimal-pad" onChange={(cardioDistanceKm) => patch({ cardioDistanceKm })} />
                  <Field compact label="时长(分钟)" value={form.cardioDurationMin} keyboardType="decimal-pad" onChange={(cardioDurationMin) => patch({ cardioDurationMin })} />
                  <Field compact label="配速" value={form.cardioPace} onChange={(cardioPace) => patch({ cardioPace })} placeholder={'6\'00"'} />
                </View>
              ) : null}
              {type === 'HABIT' ? (
                <View style={styles.grid}>
                  <Field compact label="习惯名称" value={form.habitName} onChange={(habitName) => patch({ habitName })} />
                  <Field compact label="目标(分钟)" value={form.habitTargetMin} keyboardType="number-pad" onChange={(habitTargetMin) => patch({ habitTargetMin })} />
                </View>
              ) : null}
              <Field label="建议时间" value={form.suggestedTime} onChange={(suggestedTime) => patch({ suggestedTime })} placeholder="例如：08:00" />
              <Field label="备注" value={form.notes} onChange={(notes) => patch({ notes })} placeholder="可选" />
            </ScrollView>
          ) : null}
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => (pending ? setPending(null) : onClose())} style={[styles.button, styles.secondary]}>
              <Text style={styles.secondaryText}>{pending ? '重新选择' : '取消'}</Text>
            </Pressable>
            {pending ? (
              <Pressable accessibilityRole="button" accessibilityState={{ busy: saving }} disabled={saving} onPress={() => void submit()} style={[styles.button, styles.primary, saving && styles.disabled]}>
                <Text style={styles.primaryText}>{saving ? '添加中…' : '添加到这一天'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  )
}

function Field({ label, value, onChange, placeholder, keyboardType = 'default', compact = false }: { label: string; value: string; onChange: (text: string) => void; placeholder?: string; keyboardType?: 'default' | 'decimal-pad' | 'number-pad'; compact?: boolean }) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} keyboardType={keyboardType} style={styles.input} />
    </View>
  )
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.mask,
  },
  sheet: {
    maxHeight: '80%',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    ...typography.card,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.xs,
  },
  empty: {
    color: colors.textTertiary,
    ...typography.meta,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  rowTitle: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  rowTag: {
    color: colors.brandText,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.tag,
    paddingHorizontal: spacing.xs,
    overflow: 'hidden',
    ...typography.tag,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  field: {
    gap: 4,
  },
  fieldCompact: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textSecondary,
    ...typography.meta,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    color: colors.text,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  button: {
    flex: 1,
    minHeight: controlHeight.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
  },
  primary: {
    backgroundColor: colors.brandStrong,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.controlBorder,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})
