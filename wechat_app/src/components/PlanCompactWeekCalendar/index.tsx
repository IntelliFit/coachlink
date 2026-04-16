import { ScrollView, Text, View } from '@tarojs/components'
import './index.scss'

export interface PlanCompactWeekDay {
  dayIndex: number
  label: string
  title: string
  meta: string
  rest?: boolean
  completed?: boolean
}

interface PlanCompactWeekAction {
  label: string
  danger?: boolean
  onClick: () => void
}

interface PlanCompactWeekPerWeekAction {
  label: string
  danger?: boolean
  onClick: (weekIndex: number) => void
}

interface PlanCompactWeekCalendarProps {
  weeks: PlanCompactWeekDay[][]
  currentWeekIndex: number
  selectedDayIndex: number
  title: string
  caption?: string
  expanded?: boolean
  emptyText?: string
  onSelectDay: (dayIndex: number) => void
  onPrevWeek?: () => void
  onNextWeek?: () => void
  onToggleExpanded?: () => void
  footerActions?: PlanCompactWeekAction[]
  fullWeekActions?: PlanCompactWeekPerWeekAction[]
}

export default function PlanCompactWeekCalendar({
  weeks,
  currentWeekIndex,
  selectedDayIndex,
  title,
  caption,
  expanded = false,
  emptyText = '当前还没有周历安排',
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  onToggleExpanded,
  footerActions = [],
  fullWeekActions = []
}: PlanCompactWeekCalendarProps) {
  const safeWeekIndex = Math.max(0, Math.min(currentWeekIndex, Math.max(weeks.length - 1, 0)))
  const currentWeek = weeks[safeWeekIndex] || []

  if (weeks.length === 0 || currentWeek.length === 0) {
    return (
      <View className='plan-week-nav plan-week-nav--empty'>
        <Text className='plan-week-nav__empty'>{emptyText}</Text>
      </View>
    )
  }

  return (
    <>
      <View className='plan-week-nav'>
        <View className='plan-week-nav__header'>
          <View>
            <Text className='plan-week-nav__title'>{title}</Text>
            {caption ? <Text className='plan-week-nav__caption'>{caption}</Text> : null}
          </View>
          <View className='plan-week-nav__actions'>
            {onPrevWeek ? (
              <Text className='plan-week-nav__arrow' onClick={onPrevWeek}>‹</Text>
            ) : null}
            {onNextWeek ? (
              <Text className='plan-week-nav__arrow' onClick={onNextWeek}>›</Text>
            ) : null}
            {onToggleExpanded ? (
              <Text className='plan-week-nav__link' onClick={onToggleExpanded}>
                {expanded ? '收起' : '展开'}
              </Text>
            ) : null}
          </View>
        </View>

        <ScrollView className='plan-week-nav__strip' scrollX>
          <View className='plan-week-nav__strip-inner'>
            {currentWeek.map((day) => (
              <View
                key={`current-${day.dayIndex}`}
                className={`plan-week-nav__chip ${selectedDayIndex === day.dayIndex ? 'active' : ''} ${day.rest ? 'rest' : ''} ${day.completed ? 'completed' : ''}`}
                onClick={() => onSelectDay(day.dayIndex)}
              >
                <Text className='plan-week-nav__chip-label'>{day.label}</Text>
                <Text className='plan-week-nav__chip-title'>{day.title}</Text>
                <Text className='plan-week-nav__chip-meta'>{day.meta}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {footerActions.length > 0 ? (
          <View className='plan-week-nav__footer'>
            {footerActions.map((action) => (
              <Text
                key={action.label}
                className={`plan-week-nav__link ${action.danger ? 'danger' : ''}`}
                onClick={action.onClick}
              >
                {action.label}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {expanded ? (
        <View className='plan-week-nav__list'>
          {weeks.map((week, weekIndex) => (
            <View key={`full-week-${weekIndex}`} className='plan-week-nav'>
              <View className='plan-week-nav__header'>
                <Text className='plan-week-nav__title'>第 {weekIndex + 1} 周</Text>
                {fullWeekActions.length > 0 ? (
                  <View className='plan-week-nav__actions'>
                    {fullWeekActions.map((action) => (
                      <Text
                        key={`${weekIndex}-${action.label}`}
                        className={`plan-week-nav__link ${action.danger ? 'danger' : ''}`}
                        onClick={() => action.onClick(weekIndex)}
                      >
                        {action.label}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
              <View className='plan-week-nav__grid'>
                {week.map((day) => (
                  <View
                    key={`full-${day.dayIndex}`}
                    className={`plan-week-nav__chip ${selectedDayIndex === day.dayIndex ? 'active' : ''} ${day.rest ? 'rest' : ''} ${day.completed ? 'completed' : ''}`}
                    onClick={() => onSelectDay(day.dayIndex)}
                  >
                    <Text className='plan-week-nav__chip-label'>{day.label}</Text>
                    <Text className='plan-week-nav__chip-title'>{day.title}</Text>
                    <Text className='plan-week-nav__chip-meta'>{day.meta}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  )
}
