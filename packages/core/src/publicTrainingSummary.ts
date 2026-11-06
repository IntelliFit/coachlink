/** 训练分享页的部位统计和人体图高亮，小程序公开训练页和 APP 分享页共用。 */

import { inferActionBodyParts } from './actionBodyParts'

export type PublicTrainingActionSummary = {
  actionName: string
  setsCount: number
  volume: number
}

export type MuscleScore = { label: string; score: number }

const MUSCLE_FILL_ORIGIN = '#222222'
const MUSCLE_FILL_HIGHLIGHT = '#CF6D4E'

const MUSCLE_INFERENCE_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: '胸部', keywords: ['胸', '卧推', '飞鸟', '夹胸', '俯卧撑', '双杠', '臂屈伸'] },
  { label: '背部', keywords: ['背', '引体', '划船', '下拉', '硬拉', '高位下拉'] },
  { label: '肩部', keywords: ['肩', '推举', '侧平举', '三角肌', '面拉'] },
  { label: '手臂', keywords: ['手臂', '二头', '三头', '肱二头', '肱三头', '弯举', '臂屈伸'] },
  { label: '核心', keywords: ['核心', '腹', '卷腹', '平板', '腰腹', '悬垂举腿'] },
  { label: '腿部', keywords: ['腿', '深蹲', '腿举', '弓步', '股四头', '腘绳', '蹲'] },
  { label: '臀部', keywords: ['臀', '臀桥', '髋', '硬拉'] },
]

/** 统计用的部位名和人体图 SVG 里的 category 不是一套词：手臂是大臂 + 小臂，腿部是大腿 + 小腿，核心是腹部。 */
const MUSCLE_SVG_CATEGORIES: Record<string, string[]> = {
  胸部: ['胸部'],
  背部: ['背部'],
  肩部: ['肩部'],
  手臂: ['大臂', '小臂'],
  核心: ['腹部'],
  腿部: ['大腿', '小腿'],
  臀部: ['臀部'],
}

const NON_MUSCLE_GROUPS = new Set(['肌肉', '关节', '全身轮廓'])

function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  const groupRegex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = groupRegex.exec(svg)) !== null) {
    if (!NON_MUSCLE_GROUPS.has(match[1])) map[match[1]] = match[2]
  }
  return map
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 把肌肉底色统一成深色，并把 muscleLabels 对应的肌肉涂成品牌色。 */
export function highlightBodySvg(svg: string, muscleLabels: string[]) {
  const categories = new Set(muscleLabels.reduce<string[]>((all, label) => all.concat(MUSCLE_SVG_CATEGORIES[label] || []), []))
  const dataNames = Object.entries(parseSvgCategoryMap(svg))
    .filter(([, category]) => categories.has(category))
    .map(([dataName]) => dataName)

  const base = svg
    .replace(/fill:#fff/gi, `fill:${MUSCLE_FILL_ORIGIN}`)
    .replace(/fill="#fff"/gi, `fill="${MUSCLE_FILL_ORIGIN}"`)

  return dataNames.reduce((result, dataName) => {
    const group = new RegExp(`(<g[^>]*data-name="${escapeRegExp(dataName)}"[^>]*>)([\\s\\S]*?)(</g>)`, 'g')
    return result.replace(group, (_match, open: string, content: string, close: string) => (
      open + content.split(MUSCLE_FILL_ORIGIN).join(MUSCLE_FILL_HIGHLIGHT) + close
    ))
  }, base)
}

function inferMusclesForAction(action: PublicTrainingActionSummary) {
  return inferActionBodyParts(String(action?.actionName || '').toLowerCase(), MUSCLE_INFERENCE_RULES)
}

/** 按动作名推断练到的部位，分数 = 组数 + 容量（吨），从高到低。 */
export function buildMuscleScores(actions: PublicTrainingActionSummary[]): MuscleScore[] {
  const scores = new Map<string, number>()
  actions.forEach((action) => {
    // 一组都没做的动作不算练过
    if (!Number(action.setsCount)) return
    const score = Number(action.setsCount) + Math.max(0, Math.round(Number(action.volume || 0) / 1000))
    inferMusclesForAction(action).forEach((muscle) => scores.set(muscle, (scores.get(muscle) || 0) + score))
  })
  return Array.from(scores.entries())
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
}
