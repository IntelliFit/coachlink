const WEEKDAY_TEXT = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const toDateOrNull = (value?: string | number | Date | null) => {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad2 = (value: number) => `${value}`.padStart(2, '0')

export const formatMonthDay = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export const formatDateYMD = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export const formatMonthDaySlash = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export const formatMonthDayWeekday = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${formatMonthDay(date)} ${WEEKDAY_TEXT[date.getDay()]}`
}

export const formatYearMonth = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export const formatHourMinute = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export const formatMonthDayTime = (value?: string | number | Date | null) => {
  const date = toDateOrNull(value)
  if (!date) return ''
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}
