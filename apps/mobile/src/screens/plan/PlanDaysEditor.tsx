import { useMemo, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../theme'
import type { PlanActionOption, PlanItemType, PlanTrainingDay } from './model/planTypes'
import { WEEKDAY_LABELS, addEmptyWeek, chunkDaysByWeek, cloneWeekToTail, deleteWeekAt } from './model/planEditor'
import { addActionSet, copyDayTo, moveActionSet, removeActionSet, replaceActionSet, setDayType, updateDay } from './model/planDayOps'
import { ensureSetUids, getSetActionId, withPickedAction } from './model/planSetFields'
import { normalizeItemType } from './model/planEditor'
import { ITEM_META, PlanActionSetCard } from './PlanActionSetCard'
import { PlanActionPicker } from './PlanActionPicker'

type Props = {
  days: PlanTrainingDay[]
  onChange: (days: PlanTrainingDay[]) => void
  actions: PlanActionOption[]
  /** 学员自建计划只有力量和有氧；教练端可加饮食、习惯（与小程序 student-favorite / coach 模式一致）。 */
  mode: 'student' | 'coach'
  /** 已有执行记录的天（含）之前只读，避免改动已经练过的内容。 */
  lockedThroughDayIndex?: number
  /** 打开时定位到的天（例如从学员反馈跳过来）。 */
  initialDayIndex?: number
  /** 整份计划只读（例如已完成的计划）。 */
  readOnly?: boolean
}

/** 按周排列的训练日编辑器，对应小程序 PlanEditorWorkbench 的日程 + 当天编辑区。 */
export function PlanDaysEditor({ days, onChange, actions, mode, lockedThroughDayIndex = 0, initialDayIndex, readOnly = false }: Props) {
  const weeks = useMemo(() => chunkDaysByWeek(days), [days])
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => (
    (initialDayIndex && days.some((day) => day.dayIndex === initialDayIndex) ? initialDayIndex : 0)
    || days.find((day) => day.dayIndex > lockedThroughDayIndex)?.dayIndex
    || days[0]?.dayIndex
    || 1
  ))
  const [pickerSetIndex, setPickerSetIndex] = useState<number | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const selectedDay = days.find((day) => day.dayIndex === selectedDayIndex) || days[0]
  // 已练过的天只锁结构（类型、动作、顺序），参数仍可改，与服务端 planEditLock 一致。
  const structureLocked = readOnly || Boolean(selectedDay && selectedDay.dayIndex <= lockedThroughDayIndex)
  const itemTypes: PlanItemType[] = mode === 'coach' ? ['STRENGTH', 'CARDIO', 'DIET', 'HABIT'] : ['STRENGTH', 'CARDIO']
  const sets = selectedDay?.actionSets || []

  // 新增、复制出来的动作补上稳定键；已有键不变，避免正在输入的卡片被重新挂载。
  const change = (next: PlanTrainingDay[]) => onChange(ensureSetUids(next))

  const copyTargets = selectedDay
    ? days.filter((day) => day.dayIndex !== selectedDay.dayIndex && day.dayIndex > lockedThroughDayIndex)
    : []

  const confirmDayType = (type: 'training' | 'rest') => {
    if (!selectedDay || selectedDay.type === type) return
    if (type === 'rest' && (selectedDay.actionSets || []).length > 0) {
      // 保存时休息日不带动作（与小程序一致），切换前先确认。
      Alert.alert('设为休息日？', '这一天已安排的内容会在保存时清除。', [
        { text: '取消', style: 'cancel' },
        { text: '设为休息日', style: 'destructive', onPress: () => change(setDayType(days, selectedDay.dayIndex, 'rest')) },
      ])
      return
    }
    change(setDayType(days, selectedDay.dayIndex, type))
  }

  const confirmDeleteWeek = (weekIndex: number) => {
    const firstDay = weekIndex * 7 + 1
    if (firstDay <= lockedThroughDayIndex) {
      Alert.alert('不能删除', '这一周已有训练记录。')
      return
    }
    Alert.alert('删除这一周？', `第 ${weekIndex + 1} 周的 7 天安排会被删除，后面的天数前移。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const next = deleteWeekAt(days, weekIndex)
          change(next)
          if (!next.some((day) => day.dayIndex === selectedDayIndex)) setSelectedDayIndex(next[next.length - 1]?.dayIndex || 1)
        },
      },
    ])
  }

  return (
    <View style={styles.wrap}>
      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.week}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekTitle}>第 {weekIndex + 1} 周</Text>
            {!readOnly ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`复制第 ${weekIndex + 1} 周到末尾`} onPress={() => change(cloneWeekToTail(days, weekIndex))} style={styles.weekAction}>
                <Text style={styles.weekActionText}>复制本周</Text>
              </Pressable>
            ) : null}
            {!readOnly && weeks.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`删除第 ${weekIndex + 1} 周`} onPress={() => confirmDeleteWeek(weekIndex)} style={styles.weekAction}>
                <Text style={[styles.weekActionText, styles.dangerText]}>删除</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.dayRow}>
            {week.map((day, offset) => {
              const selected = day.dayIndex === selectedDay?.dayIndex
              const dayLocked = day.dayIndex <= lockedThroughDayIndex
              const count = (day.actionSets || []).length
              return (
                <Pressable
                  key={day.dayIndex}
                  accessibilityRole="tab"
                  accessibilityLabel={`第 ${day.dayIndex} 天，${day.type === 'rest' ? '休息' : `${count} 项`}${dayLocked ? '，已锁定' : ''}`}
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedDayIndex(day.dayIndex)}
                  style={[styles.dayChip, day.type === 'rest' && styles.dayChipRest, selected && styles.dayChipActive]}
                >
                  <Text style={[styles.dayWeekday, selected && styles.dayTextActive]}>{WEEKDAY_LABELS[offset % 7]}</Text>
                  <Text style={[styles.dayNumber, selected && styles.dayTextActive]}>{day.dayIndex}</Text>
                  <Text style={[styles.dayMeta, selected && styles.dayTextActive]}>{dayLocked ? '已练' : day.type === 'rest' ? '休' : count}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
      {!readOnly ? (
        <Pressable accessibilityRole="button" accessibilityLabel="添加一周" onPress={() => change(addEmptyWeek(days))} style={styles.addWeek}>
          <Text style={styles.addWeekText}>+ 添加一周</Text>
        </Pressable>
      ) : null}

      {selectedDay ? (
        <View style={styles.dayPanel}>
          <View style={styles.dayPanelHeader}>
            <Text style={styles.dayPanelTitle}>第 {selectedDay.dayIndex} 天</Text>
            {structureLocked ? <Text style={styles.lockedTag}>{readOnly ? '只读' : '已有训练记录，只能改参数'}</Text> : (
              <View style={styles.segment}>
                {(['training', 'rest'] as const).map((type) => (
                  <Pressable
                    key={type}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: selectedDay.type === type }}
                    onPress={() => confirmDayType(type)}
                    style={[styles.segmentItem, selectedDay.type === type && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, selectedDay.type === type && styles.segmentTextActive]}>{type === 'training' ? '训练日' : '休息日'}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <TextInput
            accessibilityLabel="当天备注"
            editable={!readOnly}
            value={selectedDay.note || ''}
            onChangeText={(note) => change(updateDay(days, selectedDay.dayIndex, (day) => ({ ...day, note })))}
            placeholder={selectedDay.type === 'rest' ? '休息与恢复建议' : '当天训练重点（可选）'}
            placeholderTextColor={colors.textMuted}
            style={styles.noteInput}
          />

          {sets.length === 0 ? <Text style={styles.empty}>{selectedDay.type === 'rest' ? '休息日，可以添加拉伸、饮食等轻任务。' : '还没有动作，从下方添加。'}</Text> : null}
          {sets.map((set, setIndex) => (
            <PlanActionSetCard
              // 稳定键：移动或删除后，模式、正在输入的文本等本地状态不会串到别的卡片上。
              key={typeof set._uid === 'string' ? set._uid : `${selectedDay.dayIndex}-${setIndex}-${getSetActionId(set) || set.itemType || 'item'}`}
              actionSet={set}
              index={setIndex}
              total={sets.length}
              actions={actions}
              readOnly={readOnly}
              structureLocked={structureLocked}
              onChange={(next) => change(replaceActionSet(days, selectedDay.dayIndex, setIndex, next))}
              onPickAction={() => setPickerSetIndex(setIndex)}
              onMove={(delta) => change(moveActionSet(days, selectedDay.dayIndex, setIndex, delta))}
              onRemove={() => change(removeActionSet(days, selectedDay.dayIndex, setIndex))}
            />
          ))}

          {!structureLocked ? (
            <>
              <View style={styles.addRow}>
                {itemTypes.map((type) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityLabel={`添加${ITEM_META[type].label}`}
                    onPress={() => {
                      change(addActionSet(days, selectedDay.dayIndex, type))
                      if (type === 'STRENGTH') setPickerSetIndex(sets.length)
                    }}
                    style={[styles.addChip, { borderColor: ITEM_META[type].color }]}
                  >
                    <Text style={[styles.addChipText, { color: ITEM_META[type].color }]}>+ {ITEM_META[type].label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="把这一天复制到其他天" disabled={copyTargets.length === 0} onPress={() => setCopyOpen(true)} style={styles.copyDay}>
                <Text style={styles.copyDayText}>复制这一天到…</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      <Modal visible={copyOpen} transparent animationType="fade" onRequestClose={() => setCopyOpen(false)}>
        <View style={styles.copyMask}>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭" style={StyleSheet.absoluteFill} onPress={() => setCopyOpen(false)} />
          <View style={styles.copySheet}>
            <Text style={styles.copyTitle}>复制第 {selectedDay?.dayIndex} 天到…</Text>
            <Text style={styles.copyHint}>目标天原有安排会被覆盖；已有训练记录的天不能作为目标。</Text>
            <ScrollView style={styles.copyList} contentContainerStyle={styles.copyGrid}>
              {copyTargets.map((day) => (
                <Pressable
                  key={day.dayIndex}
                  accessibilityRole="button"
                  onPress={() => {
                    if (selectedDay) change(copyDayTo(days, selectedDay.dayIndex, day.dayIndex))
                    setCopyOpen(false)
                  }}
                  style={styles.copyTarget}
                >
                  <Text style={styles.copyTargetText}>第 {day.dayIndex} 天</Text>
                  <Text style={styles.copyTargetMeta}>{day.type === 'rest' ? '休息' : `${(day.actionSets || []).length} 项`}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setCopyOpen(false)} style={styles.copyCancel}>
              <Text style={styles.copyCancelText}>取消</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <PlanActionPicker
        visible={pickerSetIndex !== null}
        itemType={normalizeItemType(pickerSetIndex !== null ? selectedDay?.actionSets?.[pickerSetIndex]?.itemType : 'STRENGTH')}
        actions={actions}
        onClose={() => setPickerSetIndex(null)}
        onSelect={(action) => {
          if (pickerSetIndex !== null && selectedDay) {
            const current = (selectedDay.actionSets || [])[pickerSetIndex]
            if (current) {
              change(replaceActionSet(days, selectedDay.dayIndex, pickerSetIndex, withPickedAction(current, action)))
            }
          }
          setPickerSetIndex(null)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  week: {
    gap: spacing.xs,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weekTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  weekAction: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  weekActionText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  dangerText: {
    color: colors.danger,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayChip: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayChipRest: {
    backgroundColor: colors.surfaceMuted,
  },
  dayChipActive: {
    borderColor: colors.selected,
    backgroundColor: colors.selected,
  },
  dayWeekday: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
  },
  dayNumber: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dayMeta: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  dayTextActive: {
    color: colors.surface,
  },
  addWeek: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addWeekText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  dayPanel: {
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  dayPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayPanelTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  lockedTag: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  segment: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  segmentItem: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.brandDark,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.surface,
  },
  empty: {
    color: colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  addChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  addChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  copyDay: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyDayText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  copyMask: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(36,29,26,0.48)',
  },
  copySheet: {
    maxHeight: '70%',
    gap: spacing.xs,
    padding: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  copyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  copyHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  copyList: {
    flexGrow: 0,
  },
  copyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  copyTarget: {
    width: '30%',
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyTargetText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  copyTargetMeta: {
    color: colors.textTertiary,
    fontSize: 11,
  },
  copyCancel: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyCancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})
