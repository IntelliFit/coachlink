export type MotionArcadeVisualKey = 'bean' | 'pullup' | 'pushup'

export type MotionArcadeTravelMode = 'fall' | 'rise' | 'left'

export type MotionArcadeGameConfig = {
  badItemLabel: string
  bestLabel: string
  controlsDescription: string
  goodItemLabel: string
  heroDescription: string
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
  stageHintIdle: string
  stageHintPlaying: string
  tips: string[]
  travelMode: MotionArcadeTravelMode
  visualKey: MotionArcadeVisualKey
}

export const MOTION_BEAN_CONFIG: MotionArcadeGameConfig = {
  badItemLabel: '深色捣蛋豆',
  bestLabel: '最好成绩',
  controlsDescription: '优先生成带角色和豆子动画的回放；设备不支持合成时，原始方向可退回摄像头视频。',
  goodItemLabel: '能量豆',
  heroDescription:
    '一局 30 秒，身体左右挪、抬肩、挥手都能控角色。先把“人一动，屏幕也跟着动”的快乐做出来。',
  heroKicker: 'FUN MODE',
  heroTitle: '接住能量豆，把镜头前的动作变成小游戏',
  key: 'motion-bean',
  navTitle: '接豆派对',
  path: '/toolbox/motion-bean/index',
  recordingActiveLabel: '接豆回放录制中',
  replayFooterLabel: '接豆派对回放',
  scoreBad: -2,
  scoreGood: 1,
  scoreLabel: '当前分数',
  shareTitle: '我在 CoachLink 试玩了接豆派对',
  stageHintIdle: '先站进镜头里，再试着左右挪动、挥手或抬肩，去接黄色能量豆。',
  stageHintPlaying: '接黄色豆加分，躲深色豆扣分，动作越明显越容易跟上。',
  tips: [
    '站得离镜头稍远一点，让上半身完整入镜，识别会更稳。',
    '当前是轻量运动检测，不是骨骼关键点，所以夸张一点的挥手和挪肩更容易识别。',
    '默认“镜像同向”会让你的移动和屏幕角色同向；需要原摄像头方向时再切换。'
  ],
  travelMode: 'fall',
  visualKey: 'bean'
}

export const PULLUP_RUSH_CONFIG: MotionArcadeGameConfig = {
  badItemLabel: '酸胀云',
  bestLabel: '最佳连击',
  controlsDescription: '同样支持保存带动画的回放视频，适合录一段夸张版“体感引体冲刺”发给朋友。',
  goodItemLabel: '拉环',
  heroDescription:
    '这一局更像往上抢点位的小游戏。拉环会从底部往上冲，接住就叠连击，撞到酸胀云会掉分。',
  heroKicker: 'PULLUP RUN',
  heroTitle: '引体冲刺，把拉环和连击一起往上拉',
  key: 'pullup-rush',
  navTitle: '引体冲刺',
  path: '/toolbox/pullup-rush/index',
  recordingActiveLabel: '引体回放录制中',
  replayFooterLabel: '引体冲刺回放',
  scoreBad: -3,
  scoreGood: 2,
  scoreLabel: '冲刺分数',
  shareTitle: '我在 CoachLink 试玩了引体冲刺小游戏',
  stageHintIdle: '站好后多做左右移动和抬肩动作，准备去抢从下方升起的拉环。',
  stageHintPlaying: '拉环上升很快，撞酸胀云会掉分，尽量连着吃出高分。',
  tips: [
    '这局物体是从下往上冲的，动作节奏可以比接豆更快一点。',
    '如果你想玩出“拉起来”的感觉，试试配合上身抬起和左右换位。',
    '适合两个人轮流比一比谁的 30 秒冲刺分更高。'
  ],
  travelMode: 'rise',
  visualKey: 'pullup'
}

export const PUSHUP_DASH_CONFIG: MotionArcadeGameConfig = {
  badItemLabel: '偷懒砖',
  bestLabel: '最高节奏',
  controlsDescription: '玩法更像节奏闯关：右侧障碍会横向冲过来，录像里也会保留整套动画轨迹。',
  goodItemLabel: '节奏徽章',
  heroDescription:
    '把镜头前的动作感变成一场俯卧撑气氛赛。你负责动，屏幕里的角色负责左右突围和吃节奏徽章。',
  heroKicker: 'PUSHUP DASH',
  heroTitle: '俯卧撑突围，别让偷懒障碍打断你的节奏',
  key: 'pushup-dash',
  navTitle: '俯卧撑突围',
  path: '/toolbox/pushup-dash/index',
  recordingActiveLabel: '俯卧撑回放录制中',
  replayFooterLabel: '俯卧撑突围回放',
  scoreBad: -2,
  scoreGood: 1,
  scoreLabel: '节奏积分',
  shareTitle: '我在 CoachLink 试玩了俯卧撑突围小游戏',
  stageHintIdle: '先让自己完整入镜，然后试着左右挪肩，准备迎接从右边冲来的徽章和障碍。',
  stageHintPlaying: '吃到节奏徽章加分，撞到偷懒砖扣分，连续躲开会更有节奏感。',
  tips: [
    '这局是横向闯关，身体左右挪动会比原地抖动更好用。',
    '如果想更像在做俯卧撑热身，可以配合上半身起伏去带动画面节奏。',
    '录完回放以后直接保存，很适合做工具箱里的轻松小游戏分享。'
  ],
  travelMode: 'left',
  visualKey: 'pushup'
}
