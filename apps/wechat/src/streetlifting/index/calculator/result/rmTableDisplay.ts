// RM 对照表的显示文案。负重引体/臂屈伸算的是"附加重量"，次数高时会算出负数：
// 负数的意思是需要助力（弹力带、辅助机），百分比此时没有意义。
export type RmTableRowInput = { weight: number; percentage: number }

export type RmTableRowText = {
  weightText: string
  percentageText: string
  assisted: boolean
}

export function formatRmTableRow({ weight, percentage }: RmTableRowInput): RmTableRowText {
  const rounded = Math.round(weight * 10) / 10
  if (rounded < 0) {
    return { weightText: `助力 ${Math.abs(rounded).toFixed(1)} kg`, percentageText: '—', assisted: true }
  }
  return { weightText: `${Math.abs(rounded).toFixed(1)} kg`, percentageText: `${percentage}%`, assisted: false }
}
