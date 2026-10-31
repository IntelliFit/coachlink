import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { getBeijingDateParts, toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import type { PlanScheduleModel } from '@coachlink/core/src/planCalendar'
import {
  buildPlanMonthGrid,
  describePlanMonthCell,
  nextAccessibleDayIndex,
  shiftPlanMonth,
  weekStripCellHasDot,
  type WeekStripCell,
} from '@coachlink/core/src/planWeekStrip'
import { colors, radius, spacing } from '../../theme'

const MONDAY_FIRST_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const STATUS_TEXT: Record<string, string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待训练',
  rest: '休息',
  locked: '未开放',
  empty: '无安排',
}

/** 顶部周条（周日为首日），对应小程序 WeekDashboardStrip。 */
export function WeekStrip({ cells, selectedDateKey, onCellPress }: { cells: WeekStripCell[]; selectedDateKey: string; onCellPress: (cell: WeekStripCell) => void }) {
  if (cells.length !== 7) return null
  return (
    <View style={styles.weekRow}>
      {cells.map((cell) => {
        const selected = cell.dateKey === selectedDateKey
        return (
          <Pressable
            key={cell.dateKey}
            accessibilityRole="button"
            accessibilityLabel={`星期${cell.weekdayLabel} ${cell.dayNum}日，${STATUS_TEXT[cell.status] || ''}${cell.isToday ? '，今天' : ''}`}
            accessibilityState={{ selected }}
            onPress={() => onCellPress(cell)}
            style={[styles.weekPill, cell.isToday && styles.weekPillToday, selected && styles.weekPillSelected, cell.status === 'locked' && styles.weekPillLocked]}
          >
            <View style={[styles.dot, weekStripCellHasDot(cell) && (cell.status === 'completed' ? styles.dotDone : styles.dotActive), selected && weekStripCellHasDot(cell) && styles.dotOnSelected]} />
            <Text style={[styles.weekLabel, selected && styles.textOnSelected]}>{cell.weekdayLabel}</Text>
            <Text style={[styles.weekNum, selected && styles.textOnSelected]}>{cell.dayNum}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

type CalendarSheetProps = {
  visible: boolean
  onClose: () => void
  selectedDate: Date
  selectedDayIndex: number
  scheduleModel: PlanScheduleModel
  trainingDays: any[]
  executionsByDayIndex: Record<number, any>
  completionDates: Record<number, string>
  startExecutionDay: number
  unlockedWeek: number
  progress: { done: number; total: number; percent: number }
  missingDays: number[]
  onSelectDay: (dayIndex: number) => void
  onMakeUpDay: (dayIndex: number) => void
  onSkipDay: (dayIndex: number) => void
}

/** 训练日历弹层（月历），对应小程序 today-training 的「月历」Popup + ScheduleCalendarPanel monthOnly。 */
export function TrainingCalendarSheet(props: CalendarSheetProps) {
  const { visible, onClose, selectedDate, selectedDayIndex, scheduleModel } = props
  const [cursor, setCursor] = useState(() => monthOf(selectedDate))
  // 按日期键比较：后台刷新会生成新的 Date 对象，不能因此把用户翻到的月份跳回去
  const selectedDateKey = toBeijingDateKey(selectedDate)
  useEffect(() => {
    if (visible) setCursor(monthOf(selectedDate))
  }, [selectedDateKey, visible])
  const grid = useMemo(() => buildPlanMonthGrid(cursor.year, cursor.month), [cursor])
  const needsReview = Array.from(scheduleModel.scheduleByDayIndex.values()).some((info) => info.dateNeedsReview)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭训练日历" style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>训练日历</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>
        <Text style={styles.progressText}>计划已完成 {props.progress.done}/{props.progress.total} 个训练日 · {props.progress.percent}%</Text>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <View style={styles.monthHead}>
            <Pressable accessibilityRole="button" accessibilityLabel="上个月" onPress={() => setCursor((value) => shiftPlanMonth(value, -1))} style={styles.monthNav}>
              <Text style={styles.monthNavText}>‹</Text>
            </Pressable>
            <Text style={styles.monthTitle}>{cursor.year}年{cursor.month}月</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="下个月" onPress={() => setCursor((value) => shiftPlanMonth(value, 1))} style={styles.monthNav}>
              <Text style={styles.monthNavText}>›</Text>
            </Pressable>
          </View>
          <View style={styles.monthRow}>
            {MONDAY_FIRST_LABELS.map((label) => <Text key={label} style={styles.weekdayCell}>{label}</Text>)}
          </View>
          <View style={styles.monthGrid}>
            {grid.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={styles.dateCell} />
              const cell = describePlanMonthCell({ date, scheduleModel, trainingDays: props.trainingDays, executionsByDayIndex: props.executionsByDayIndex,
                completionDates: props.completionDates, startExecutionDay: props.startExecutionDay, unlockedWeek: props.unlockedWeek, selectedDayIndex })
              const hasPlan = cell.dayIndexes.length > 0
              const done = cell.status === 'completed' || cell.status === 'before_start'
              return (
                <Pressable
                  key={cell.dateKey}
                  accessibilityRole="button"
                  accessibilityLabel={`${cursor.month}月${cell.dayNum}日${hasPlan ? `，${cell.dayLabel}，${cell.typeLabel === '✓' ? '已完成' : cell.typeLabel}` : ''}${cell.locked ? '，未开放' : ''}`}
                  accessibilityState={{ selected: cell.isSelected, disabled: cell.accessibleDays.length === 0 }}
                  disabled={cell.accessibleDays.length === 0}
                  onPress={() => {
                    const next = nextAccessibleDayIndex(cell.accessibleDays, selectedDayIndex)
                    if (next !== null) props.onSelectDay(next)
                  }}
                  style={[
                    styles.dateCell,
                    hasPlan && styles.dateCellPlan,
                    done && styles.dateCellDone,
                    cell.status === 'in_progress' && styles.dateCellActive,
                    cell.isToday && styles.dateCellToday,
                    cell.isSelected && styles.dateCellSelected,
                    cell.locked && styles.dateCellLocked,
                  ]}
                >
                  <Text style={[styles.dateNum, cell.isSelected && styles.textOnSelected]}>{cell.dayNum}</Text>
                  <Text numberOfLines={1} style={[styles.dateMeta, cell.isSelected && styles.textOnSelected]}>{cell.dayLabel}</Text>
                  <Text numberOfLines={1} style={[styles.dateType, done && styles.dateTypeDone, cell.isSelected && styles.textOnSelected]}>{cell.typeLabel}</Text>
                </Pressable>
              )
            })}
          </View>
          {needsReview ? (
            <Text style={styles.reviewHint}>已按教练计划顺序恢复安排。「推算」日期不是已确认的实际训练日，原始提交时间保留；选中记录可核对训练日期。同日多条可再次点击切换。</Text>
          ) : null}
          {props.missingDays.map((dayIndex) => (
            <View key={dayIndex} style={styles.missingRow}>
              <Text style={styles.missingText}>第{dayIndex}天未确认</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`补练第 ${dayIndex} 天`} onPress={() => props.onMakeUpDay(dayIndex)} style={styles.missingAction}>
                <Text style={styles.missingActionText}>补练</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`跳过第 ${dayIndex} 天`} onPress={() => props.onSkipDay(dayIndex)} style={styles.missingAction}>
                <Text style={styles.missingActionText}>跳过</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

function monthOf(date: Date) {
  const parts = getBeijingDateParts(date)
  return { year: parts.year, month: parts.month }
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', gap: 4 },
  weekPill: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  weekPillToday: { borderWidth: 1, borderColor: colors.brand },
  weekPillSelected: { backgroundColor: colors.selected, borderColor: colors.selected },
  weekPillLocked: { opacity: 0.5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: colors.brand },
  dotDone: { backgroundColor: colors.success },
  dotOnSelected: { backgroundColor: '#FFFFFF' },
  weekLabel: { color: colors.textTertiary, fontSize: 11 },
  weekNum: { color: colors.text, fontSize: 16, fontWeight: '700' },
  textOnSelected: { color: colors.selectedText },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.36)' },
  sheet: { maxHeight: '82%', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.background },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  closeButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textSecondary, fontSize: 14 },
  progressText: { color: colors.textSecondary, fontSize: 13 },
  sheetBody: { gap: spacing.xs, paddingBottom: spacing.md },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  monthNavText: { color: colors.text, fontSize: 22 },
  monthTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  monthRow: { flexDirection: 'row' },
  weekdayCell: { width: `${100 / 7}%`, textAlign: 'center', color: colors.textTertiary, fontSize: 12 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dateCell: { width: `${100 / 7}%`, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent' },
  dateCellPlan: { backgroundColor: colors.surface },
  dateCellDone: { backgroundColor: colors.successSoft },
  dateCellActive: { backgroundColor: colors.brandSoft },
  dateCellToday: { borderColor: colors.brand },
  dateCellSelected: { backgroundColor: colors.selected, borderColor: colors.selected },
  dateCellLocked: { opacity: 0.45 },
  dateNum: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dateMeta: { color: colors.textTertiary, fontSize: 10 },
  dateType: { color: colors.textSecondary, fontSize: 10 },
  dateTypeDone: { color: colors.success, fontWeight: '700' },
  reviewHint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  missingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF7ED' },
  missingText: { flex: 1, color: colors.text, fontSize: 13 },
  missingAction: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  missingActionText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
})
