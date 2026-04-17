import { formatMonthDay } from './dateFormat'

const startOfDay = (value: string | Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const addDays = (value: string | Date, offset: number) => {
  const date = startOfDay(value)
  date.setDate(date.getDate() + offset)
  return date
}

export function calculateCurrentWeek(startDate?: string | Date | null) {
  if (!startDate) return 1

  const start = startOfDay(startDate)
  const now = startOfDay(new Date())
  if (start.getTime() > now.getTime()) return 1

  const diffDays = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(1, Math.ceil((diffDays + 1) / 7))
}

export function getDayWeekNumber(dayIndex: number) {
  return Math.max(1, Math.ceil(dayIndex / 7))
}

export function isDayUnlocked(dayIndex: number, unlockedWeek: number) {
  return getDayWeekNumber(dayIndex) <= unlockedWeek
}

export function getUnlockDate(weekNumber: number, startDate?: string | Date | null) {
  if (!startDate) return null
  return addDays(startDate, (weekNumber - 1) * 7)
}

export function formatUnlockDate(date: Date | null) {
  return formatMonthDay(date)
}
