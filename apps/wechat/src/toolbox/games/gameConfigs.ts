export type MotionArcadeVisualKey = 'bean' | 'pullup' | 'pushup'

export type MotionArcadeTravelMode = 'fall' | 'rise' | 'left'

export type MotionArcadeGameConfig = {
  badItemLabel: string
  bestLabel: string
  goodItemLabel: string
  heroKicker: string
  heroTitle: string
  key: string
  navTitle: string
  path: string
  recordingActiveLabel: string
  replayFooterLabel: string
  scoreBad: number
  scoreGood: number
  scoreLabel: string
  shareTitle: string
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
  navTitle: '接豆派对',
  path: '/toolbox/motion-bean/index',
  recordingActiveLabel: '接豆回放录制中',
  replayFooterLabel: '接豆派对回放',
  scoreBad: -2,
  scoreGood: 1,
  scoreLabel: '当前分数',
  shareTitle: '我在 CoachLink 试玩了接豆派对',
  travelMode: 'fall',
  visualKey: 'bean'
}

export const PULLUP_RUSH_CONFIG: MotionArcadeGameConfig = {
  badItemLabel: '酸胀云',
  bestLabel: '最佳连击',
  goodItemLabel: '拉环',
  heroKicker: 'PULLUP RUN',
  heroTitle: '向上拉，穿过障碍',
  key: 'pullup-rush',
  navTitle: '引体冲刺',
  path: '/toolbox/pullup-rush/index',
  recordingActiveLabel: '引体回放录制中',
  replayFooterLabel: '引体冲刺回放',
  scoreBad: -3,
  scoreGood: 2,
  scoreLabel: '冲刺分数',
  shareTitle: '我在 CoachLink 试玩了引体冲刺小游戏',
  travelMode: 'rise',
  visualKey: 'pullup'
}

export const PUSHUP_DASH_CONFIG: MotionArcadeGameConfig = {
  badItemLabel: '偷懒砖',
  bestLabel: '最高节奏',
  goodItemLabel: '节奏徽章',
  heroKicker: 'PUSHUP DASH',
  heroTitle: '完成俯卧撑，撞开障碍',
  key: 'pushup-dash',
  navTitle: '俯卧撑突围',
  path: '/toolbox/pushup-dash/index',
  recordingActiveLabel: '俯卧撑回放录制中',
  replayFooterLabel: '俯卧撑突围回放',
  scoreBad: -2,
  scoreGood: 1,
  scoreLabel: '节奏积分',
  shareTitle: '我在 CoachLink 试玩了俯卧撑突围小游戏',
  travelMode: 'left',
  visualKey: 'pushup'
}
