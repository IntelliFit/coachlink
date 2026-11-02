export type MotionArcadeVisualKey = 'bean'

export type MotionArcadeTravelMode = 'fall' | 'rise' | 'left'

export type MotionArcadeGameConfig = {
  badItemLabel: string
  bestLabel: string
  goodItemLabel: string
  heroKicker: string
  heroTitle: string
  key: string
  maxActiveItems: number
  navTitle: string
  path: string
  recordingActiveLabel: string
  replayFooterLabel: string
  scoreBad: number
  scoreGood: number
  scoreLabel: string
  shareTitle: string
  spawnChance: number
  trackingAnchor: 'body' | 'head'
  travelMode: MotionArcadeTravelMode
  visualKey: MotionArcadeVisualKey
}

export const MOTION_BEAN_CONFIG: MotionArcadeGameConfig = {
  badItemLabel: '深色捣蛋豆',
  bestLabel: '最好成绩',
  goodItemLabel: '能量豆',
  heroKicker: 'FUN MODE',
  heroTitle: '移动身体，接住能量豆',
  key: 'motion-bean',
  maxActiveItems: 6,
  navTitle: '接豆派对',
  path: '/toolbox/motion-bean/index',
  recordingActiveLabel: '接豆回放录制中',
  replayFooterLabel: '接豆派对回放',
  scoreBad: -2,
  scoreGood: 1,
  scoreLabel: '当前分数',
  shareTitle: '我在 CoachLink 试玩了接豆派对',
  spawnChance: 0.055,
  trackingAnchor: 'head',
  travelMode: 'fall',
  visualKey: 'bean'
}
