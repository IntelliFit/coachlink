import React, { useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import type { WeekStripCell } from '@coachlink/core/src/planWeekStrip'
import './WeekDashboardStrip.scss'

// 周条日期计算与 APP 共用 packages/core/src/planWeekStrip.ts
export { buildWeekStripCells, getSundayWeekStart } from '@coachlink/core/src/planWeekStrip'
export type { WeekStripCell, WeekStripCellStatus } from '@coachlink/core/src/planWeekStrip'

interface WeekDashboardStripProps {
  cells: WeekStripCell[]
  selectedDateKey: string
  onCellPress: (cell: WeekStripCell) => void
}

function WeekDashboardStrip({ cells, selectedDateKey, onCellPress }: WeekDashboardStripProps) {
  const safeCells = useMemo(() => (cells.length === 7 ? cells : []), [cells])

  return (
    <View className='week-dashboard-strip'>
      {/* 关闭 enhanced：部分机型上横向 scroll-view 易吞掉子节点 tap */}
      <ScrollView scrollX className='week-dashboard-strip__scroll' showScrollbar={false}>
        <View className='week-dashboard-strip__row'>
          {safeCells.map((cell) => {
            const selected = cell.dateKey === selectedDateKey
            const showDot =
              cell.planDayIndex != null &&
              cell.status !== 'empty' &&
              cell.status !== 'locked' &&
              (cell.status === 'completed' ||
                cell.status === 'in_progress' ||
                cell.status === 'pending' ||
                cell.status === 'rest')

            return (
              <View
                key={cell.dateKey}
                className={`week-dashboard-strip__pill week-dashboard-strip__pill--${cell.status} ${selected ? 'week-dashboard-strip__pill--selected' : ''} ${
                  cell.isToday ? 'week-dashboard-strip__pill--today' : ''
                }`}
                hoverClass='week-dashboard-strip__pill--active'
                hoverStayTime={70}
                onClick={() => onCellPress(cell)}
              >
                {showDot ? <View className='week-dashboard-strip__dot' /> : <View className='week-dashboard-strip__dot-placeholder' />}
                <Text className='week-dashboard-strip__wd'>{cell.weekdayLabel}</Text>
                <Text className='week-dashboard-strip__num'>{cell.dayNum}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

export default WeekDashboardStrip
