import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { addBeijingDays, toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import { createCompletionRequestId, suggestPerformedOn, validatePerformedOn } from '@coachlink/core/src/completionDate'
import { apiClient } from '../../api'
import { colors, radius, spacing } from '../../theme'

type RecordCompletionSheetProps = {
  visible: boolean
  instanceId: string
  dayIndex: number
  execution?: any
  /** 计划开始日期，补记不能早于它。 */
  earliestDate?: string | null
  onClose: () => void
  onSaved: (execution: any) => void | Promise<void>
}

/**
 * 补记 / 核对训练日期，对应小程序 RecordCompletionButton。
 * 只确认「这一天确实练过」：不补造重量次数，更正日期不重复扣权益（服务端保证）。
 */
export function RecordCompletionSheet({ visible, instanceId, dayIndex, execution, earliestDate, onClose, onSaved }: RecordCompletionSheetProps) {
  const today = toBeijingDateKey(new Date())
  const earliest = earliestDate ? toBeijingDateKey(earliestDate) : ''
  const [date, setDate] = useState('')
  const [requestId, setRequestId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isCorrection = String(execution?.status || '') === 'completed'
  const label = isCorrection ? '核对训练日期' : '补记已练过的这一天'

  useEffect(() => {
    if (!visible) return
    setDate(suggestPerformedOn(execution) || today)
    setRequestId(createCompletionRequestId())
    setError('')
  }, [execution, today, visible])

  const pick = (next: string) => {
    if (!next || next > today || (earliest && next < earliest)) return
    setDate(next)
    // 换日期就是一次新的确认，避免服务端按旧请求去重。
    setRequestId(createCompletionRequestId())
    setError('')
  }

  const shift = (days: number) => pick(toBeijingDateKey(addBeijingDays(`${date || today}T00:00:00+08:00`, days)))

  const submit = async () => {
    if (saving) return
    const invalid = validatePerformedOn(date, earliestDate)
    if (invalid) {
      setError(invalid)
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await apiClient.request<any>('/api/execution/record-completion', {
        method: 'POST',
        body: {
          instanceId,
          dayIndex,
          performedOn: date,
          requestId,
          executionId: execution?.id,
          expectedUpdatedAt: execution?.id ? execution?.updated_at : undefined,
        },
        timeoutMs: 15_000,
      })
      onClose()
      await Promise.resolve(onSaved(saved)).catch(() => undefined)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '补记失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const yesterday = toBeijingDateKey(addBeijingDays(`${today}T00:00:00+08:00`, -1))
  const quickPicks = [
    { label: '今天', value: today },
    { label: '昨天', value: yesterday },
  ].filter((item) => !earliest || item.value >= earliest)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.mask}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭" style={StyleSheet.absoluteFill} onPress={() => !saving && onClose()} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>第 {dayIndex} 天 · {label}</Text>
          <Text style={styles.desc}>请选择实际训练的那一天，不是原计划安排日，也不是补点按钮的今天。</Text>

          <View style={styles.stepper}>
            <Pressable accessibilityRole="button" accessibilityLabel="前一天" disabled={saving || (Boolean(earliest) && date <= earliest)} onPress={() => shift(-1)} style={styles.stepButton}>
              <Text style={styles.stepText}>‹</Text>
            </Pressable>
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>实际训练日期</Text>
              <Text style={styles.dateValue}>{date || '请选择'}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="后一天" disabled={saving || date >= today} onPress={() => shift(1)} style={styles.stepButton}>
              <Text style={styles.stepText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.quickRow}>
            {quickPicks.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected: date === item.value }}
                onPress={() => pick(item.value)}
                style={[styles.quickChip, date === item.value && styles.quickChipActive]}
              >
                <Text style={[styles.quickText, date === item.value && styles.quickTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.note}>确认表示当天确实练过。已有重量、次数和视频保持不变；没有记录的组不会补齐，更正日期不重复扣权益。</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !date, busy: saving }} disabled={saving || !date} onPress={() => void submit()} style={[styles.primary, (saving || !date) && styles.disabled]}>
            <Text style={styles.primaryText}>{saving ? '保存中…' : `确认在 ${date || '所选日期'} 练过`}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={styles.secondary}>
            <Text style={styles.secondaryText}>取消</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  mask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(36,29,26,0.48)',
  },
  sheet: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  desc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepText: {
    color: colors.brand,
    fontSize: 24,
    fontWeight: '600',
  },
  dateBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  dateLabel: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '700',
  },
  dateValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipActive: {
    borderColor: colors.selected,
    backgroundColor: colors.selected,
  },
  quickText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  quickTextActive: {
    color: colors.selectedText,
  },
  note: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  primary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  primaryText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '600',
  },
  secondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
})
