import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'
import { restMinutesToSeconds, restSecondsToMinutes } from '@coachlink/core/src/restDisplay'
import type { PlanActionOption, PlanActionSet, PlanItemType } from './model/planTypes'
import { normalizeItemType, resolveActionDisplayName } from './model/planEditor'
import { applyStrengthControlValue, getStrengthControlValue } from './model/planStrength'
import { getSetNote, getSetReps, getSetRestSeconds, getSetSets, getSetWeight, withFixedLoad, withSetCounts, withSetNote, withoutFixedLoad } from './model/planSetFields'

export const ITEM_META: Record<PlanItemType, { label: string; color: string; soft: string }> = {
  STRENGTH: { label: '力量', color: colors.brand, soft: colors.brandSoft },
  CARDIO: { label: '有氧', color: '#3B7DD8', soft: '#E8F0FB' },
  DIET: { label: '饮食', color: '#3C8D5A', soft: '#E7F4EC' },
  HABIT: { label: '习惯', color: '#7A5AC8', soft: '#EFEAFA' },
}

type IntensityMode = 'rm' | 'percentage' | 'fixed'

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function numberText(value: unknown) {
  const parsed = toNumber(value)
  return parsed === null || parsed === 0 ? '' : String(parsed)
}

/** 强度存成 `intensity`（'8RM' / '75%'）+ `intensityConfig.relativeIntensity`，旧计划可能只有中文键「强度」。 */
function readStrengthControl(set: PlanActionSet) {
  const params = set.params || {}
  const source = params?.intensityConfig?.relativeIntensity ? params.intensityConfig : (params?.intensity || params?.['强度'])
  return getStrengthControlValue(source, getSetWeight(set) ?? params?.intensityConfig?.recommendedLoad?.value)
}

function patchCustom(set: PlanActionSet, patch: Record<string, unknown>, extra: Record<string, unknown> = {}): PlanActionSet {
  const params = { ...(set.params || {}) }
  params.custom_data = { ...(params.custom_data || {}), ...patch }
  return { ...set, params: { ...params, ...extra } }
}

type Props = {
  actionSet: PlanActionSet
  index: number
  total: number
  actions: PlanActionOption[]
  /** 整个计划只读（例如已完成的计划）。 */
  readOnly: boolean
  /** 已有训练记录的天：不能换动作、增删或调整顺序，但组数、次数、重量、备注仍可改（与 planEditLock 一致）。 */
  structureLocked: boolean
  onChange: (next: PlanActionSet) => void
  onPickAction: () => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
}

export function PlanActionSetCard({ actionSet, index, total, actions, readOnly, structureLocked, onChange, onPickAction, onMove, onRemove }: Props) {
  const itemType = normalizeItemType(actionSet.itemType)
  const meta = ITEM_META[itemType]
  const params = actionSet.params || {}
  const custom = params.custom_data || {}
  const name = resolveActionDisplayName(actionSet, actions)
  const canEditStructure = !readOnly && !structureLocked

  const storedControl = itemType === 'STRENGTH' ? readStrengthControl(actionSet) : null
  // 切换模式时数值先清空，读回来会落到默认 RM；用本地状态记住刚选的模式，直到填入数值。
  const [pendingMode, setPendingMode] = useState<IntensityMode | null>(null)
  const control = storedControl && !storedControl.value && pendingMode ? { mode: pendingMode, value: '' } : storedControl

  const switchMode = (mode: IntensityMode) => {
    setPendingMode(mode)
    if (mode === 'fixed') {
      const load = getSetWeight(actionSet)
      onChange({ ...actionSet, params: applyStrengthControlValue(params, { mode, value: load && load > 0 ? String(load) : '' }) })
      return
    }
    const base = withoutFixedLoad(actionSet)
    onChange({ ...base, params: applyStrengthControlValue(base.params || {}, { mode, value: control?.mode === mode ? control.value : '' }) })
  }

  const applyIntensity = (text: string) => {
    const mode = control?.mode || 'rm'
    // 记住当前模式：清空数值后读回来会落到别的模式，接着输入的数字不能换模式保存。
    setPendingMode(mode)
    if (mode === 'fixed') {
      const value = toNumber(text)
      const next = { ...actionSet, params: applyStrengthControlValue(params, { mode, value: text }) }
      onChange(value && value > 0 ? withFixedLoad(next, value) : withoutFixedLoad(next))
      return
    }
    // RM / %1RM 不带固定重量（包括服务端算好的推荐重量），否则清空后会被读成「固定」。
    const base = withoutFixedLoad(actionSet)
    onChange({ ...base, params: applyStrengthControlValue(base.params || {}, { mode, value: text }) })
  }

  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      <View style={styles.header}>
        <Text style={styles.index}>#{index + 1}</Text>
        <Text style={[styles.tag, { color: meta.color, backgroundColor: meta.soft }]}>{meta.label}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="选择动作" disabled={!canEditStructure} onPress={onPickAction} style={styles.nameButton}>
          <Text style={[styles.name, !name && styles.namePlaceholder]} numberOfLines={1}>
            {name || (canEditStructure ? '点击选择动作' : meta.label)}
          </Text>
        </Pressable>
        {canEditStructure ? (
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="上移" disabled={index === 0} onPress={() => onMove(-1)} style={[styles.iconButton, index === 0 && styles.disabled]}>
              <Text style={styles.iconText}>↑</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="下移" disabled={index >= total - 1} onPress={() => onMove(1)} style={[styles.iconButton, index >= total - 1 && styles.disabled]}>
              <Text style={styles.iconText}>↓</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="删除" onPress={onRemove} style={styles.iconButton}>
              <Text style={[styles.iconText, styles.danger]}>×</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {itemType === 'STRENGTH' ? (
        <>
          <View style={styles.grid}>
            <NumberField label="组数" value={numberText(getSetSets(actionSet))} readOnly={readOnly} onCommit={(value) => onChange(withSetCounts(actionSet, { sets: Math.max(0, Math.floor(value)) }))} />
            <NumberField label="次数" value={numberText(getSetReps(actionSet))} readOnly={readOnly} onCommit={(value) => onChange(withSetCounts(actionSet, { reps: Math.max(0, Math.floor(value)) }))} />
            <NumberField
              label="休息(分)"
              decimal
              value={(() => {
                const minutes = restSecondsToMinutes(getSetRestSeconds(actionSet))
                return minutes === null ? '' : String(minutes)
              })()}
              readOnly={readOnly}
              onCommit={(value) => onChange(withSetCounts(actionSet, { restSeconds: restMinutesToSeconds(value) ?? 0 }))}
            />
          </View>
          <View style={styles.intensityRow}>
            {(['rm', 'percentage', 'fixed'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="tab"
                accessibilityState={{ selected: control?.mode === mode, disabled: readOnly }}
                disabled={readOnly}
                onPress={() => switchMode(mode)}
                style={[styles.modeChip, control?.mode === mode && styles.modeChipActive]}
              >
                <Text style={[styles.modeText, control?.mode === mode && styles.modeTextActive]}>{mode === 'rm' ? 'RM' : mode === 'percentage' ? '%1RM' : '固定'}</Text>
              </Pressable>
            ))}
            <View style={styles.flex}>
              <TextValueInput
                accessibilityLabel="强度"
                value={control?.value || ''}
                readOnly={readOnly}
                placeholder={control?.mode === 'fixed' ? '60' : control?.mode === 'percentage' ? '75' : '8'}
                keyboardType="decimal-pad"
                onCommit={applyIntensity}
                commitWhile={(text) => text === '' || /^\d+(\.\d+)?$/.test(text)}
              />
            </View>
            <Text style={styles.unit}>{control?.mode === 'fixed' ? 'kg' : control?.mode === 'percentage' ? '%' : 'RM'}</Text>
          </View>
        </>
      ) : null}

      {itemType === 'CARDIO' ? (
        <>
          <TextField label="内容" value={String(custom.content || '')} readOnly={readOnly} placeholder="例如：慢跑、椭圆机" onChange={(text) => onChange(patchCustom(actionSet, { content: text }))} />
          <View style={styles.grid}>
            <NumberField label="时长(分)" decimal value={numberText(toNumber(custom.duration) === null ? null : Number(custom.duration) / 60)} readOnly={readOnly} onCommit={(value) => onChange(patchCustom(actionSet, { duration: Math.round(value * 60) }))} />
            <NumberField label="距离(km)" decimal value={numberText(custom.distance)} readOnly={readOnly} onCommit={(value) => onChange(patchCustom(actionSet, { distance: value }))} />
          </View>
        </>
      ) : null}

      {itemType === 'DIET' ? (
        <>
          <TextField label="饮食建议" value={String(custom.content || '')} readOnly={readOnly} placeholder="例如：早餐 2 个鸡蛋 + 燕麦" onChange={(text) => onChange(patchCustom(actionSet, { content: text }))} />
          <View style={styles.grid}>
            <NumberField label="热量(kcal)" value={numberText(custom.calories)} readOnly={readOnly} onCommit={(value) => onChange(patchCustom(actionSet, { calories: Math.max(0, Math.floor(value)) }))} />
            <TextField compact label="建议时间" value={String(params.suggested_time || '')} readOnly={readOnly} placeholder="08:00" onChange={(text) => onChange({ ...actionSet, params: { ...params, suggested_time: text } })} />
          </View>
        </>
      ) : null}

      {itemType === 'HABIT' ? (
        <View style={styles.grid}>
          <TextField compact label="习惯名称" value={String(custom.habit_name || '')} readOnly={readOnly} placeholder="例如：拉伸" onChange={(text) => onChange(patchCustom(actionSet, { habit_name: text }))} />
          <NumberField label="目标(分钟)" value={numberText(custom.target_duration)} readOnly={readOnly} onCommit={(value) => onChange(patchCustom(actionSet, { target_duration: Math.max(0, Math.floor(value)) }))} />
        </View>
      ) : null}

      <TextField label="备注" value={getSetNote(actionSet)} readOnly={readOnly} placeholder="动作要点、注意事项" onChange={(text) => onChange(withSetNote(actionSet, text))} />
    </View>
  )
}

/**
 * 保留用户正在输入的文本（例如「62.」），只有能解析成完整数值时才回写；失焦时再回写一次。
 * 外部值变化（例如切换模式、撤销）时同步回来。
 */
function TextValueInput({
  value,
  readOnly,
  placeholder,
  keyboardType,
  accessibilityLabel,
  onCommit,
  commitWhile,
}: {
  value: string
  readOnly: boolean
  placeholder?: string
  keyboardType: 'number-pad' | 'decimal-pad'
  accessibilityLabel: string
  onCommit: (text: string) => void
  commitWhile: (text: string) => boolean
}) {
  const [text, setText] = useState(value)
  const focusedRef = useRef(false)
  const lastCommittedRef = useRef(value)

  useEffect(() => {
    if (!focusedRef.current && value !== lastCommittedRef.current) {
      setText(value)
      lastCommittedRef.current = value
    }
  }, [value])

  const commit = (next: string) => {
    if (next === lastCommittedRef.current) return
    lastCommittedRef.current = next
    onCommit(next)
  }

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      editable={!readOnly}
      value={text}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={() => {
        focusedRef.current = false
        const cleaned = text.trim().replace(/\.$/, '')
        // 不合法或空的输入（数值字段）不写回，恢复成当前值，避免把休息、次数写成 0。
        if (!commitWhile(cleaned)) {
          setText(lastCommittedRef.current)
          return
        }
        if (cleaned !== text) setText(cleaned)
        commit(cleaned)
      }}
      onChangeText={(next) => {
        setText(next)
        if (commitWhile(next)) commit(next)
      }}
      keyboardType={keyboardType}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      style={styles.fieldInput}
    />
  )
}

function NumberField({ label, value, readOnly, decimal = false, onCommit }: { label: string; value: string; readOnly: boolean; decimal?: boolean; onCommit: (value: number) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextValueInput
        accessibilityLabel={label}
        value={value}
        readOnly={readOnly}
        placeholder="-"
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        onCommit={(text) => onCommit(Number(text) || 0)}
        commitWhile={(text) => (decimal ? /^\d+(\.\d+)?$/ : /^\d+$/).test(text)}
      />
    </View>
  )
}

function TextField({ label, value, readOnly, placeholder, compact = false, onChange }: { label: string; value: string; readOnly: boolean; placeholder?: string; compact?: boolean; onChange: (text: string) => void }) {
  return (
    <View style={compact ? styles.field : styles.textField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!readOnly}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.fieldInput}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  index: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  tag: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
  },
  nameButton: {
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  namePlaceholder: {
    color: colors.brand,
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  danger: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.3,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  flex: {
    flex: 1,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  textField: {
    gap: 4,
  },
  fieldLabel: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldInput: {
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipActive: {
    borderColor: colors.selected,
    backgroundColor: colors.selected,
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: colors.selectedText,
    fontWeight: '700',
  },
  unit: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
})
