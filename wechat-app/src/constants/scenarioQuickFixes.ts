export interface ScenarioQuickFixStep {
  id: string
  order: number
  title: string
  description: string
  durationSeconds: number
}

export interface ScenarioQuickFix {
  id: string
  title: string
  slug: string
  description: string
  icon: string
  durationMinutes: number
  steps: ScenarioQuickFixStep[]
}

export const SCENARIO_QUICK_FIXES: ScenarioQuickFix[] = [
  {
    id: 'office-neck',
    title: '办公族肩颈救星',
    slug: 'office-neck',
    description: '久坐办公后的肩颈放松方案，5分钟快速缓解。',
    icon: '💼',
    durationMinutes: 5,
    steps: [
      { id: 'office-neck-1', order: 1, title: '颈部前后屈伸', description: '轻轻低头，下巴靠近胸口保持3秒；再缓慢抬头向后仰，保持3秒。', durationSeconds: 30 },
      { id: 'office-neck-2', order: 2, title: '颈部左右侧屈', description: '左耳尽量靠近左肩，保持15秒；换右侧重复。', durationSeconds: 30 },
      { id: 'office-neck-3', order: 3, title: '颈部旋转', description: '缓慢顺时针转动头部一圈，再逆时针转动一圈。', durationSeconds: 30 },
      { id: 'office-neck-4', order: 4, title: '耸肩放松', description: '双肩尽量向上耸，保持5秒后放松，重复5次。', durationSeconds: 30 },
      { id: 'office-neck-5', order: 5, title: '肩部环绕', description: '双臂自然下垂，肩部向前画圈5次，再向后画圈5次。', durationSeconds: 30 },
      { id: 'office-neck-6', order: 6, title: '胸椎伸展', description: '双手交叉放头后，胸部向上挺起，眼睛看上方，保持10秒。', durationSeconds: 30 }
    ]
  },
  {
    id: 'sitting-back',
    title: '久坐腰痛缓解',
    slug: 'sitting-back',
    description: '针对久坐导致的腰背不适，站立或坐姿都可完成。',
    icon: '🪑',
    durationMinutes: 6,
    steps: [
      { id: 'sitting-back-1', order: 1, title: '骨盆前后倾', description: '坐姿交替做骨盆前倾和后倾动作，各10次。', durationSeconds: 60 },
      { id: 'sitting-back-2', order: 2, title: '猫牛式伸展', description: '双手撑地，交替拱背和塌腰，各8次。', durationSeconds: 60 },
      { id: 'sitting-back-3', order: 3, title: '坐姿扭转', description: '右手放左膝外侧，左手放身后，扭转躯干15秒；换边重复。', durationSeconds: 60 },
      { id: 'sitting-back-4', order: 4, title: '髋屈肌拉伸', description: '弓步位，后腿膝盖着地，前推髋部感受大腿前侧拉伸。', durationSeconds: 60 },
      { id: 'sitting-back-5', order: 5, title: '仰卧抱膝', description: '仰卧，双手抱膝拉向胸口，保持30秒。', durationSeconds: 30 },
      { id: 'sitting-back-6', order: 6, title: '腿部交叉拉伸', description: '仰卧，右脚踝放左膝上，双手抱左大腿拉向胸口，每侧30秒。', durationSeconds: 60 }
    ]
  },
  {
    id: 'post-run',
    title: '跑步后拉伸',
    slug: 'post-run',
    description: '跑步训练后的下肢放松与恢复方案。',
    icon: '🏃',
    durationMinutes: 8,
    steps: [
      { id: 'post-run-1', order: 1, title: '股四头肌拉伸', description: '站立单腿后勾，手抓脚踝拉向臀部，每侧30秒。', durationSeconds: 60 },
      { id: 'post-run-2', order: 2, title: '腘绳肌拉伸', description: '单腿前伸脚跟着地，身体前倾感受大腿后侧拉伸，每侧30秒。', durationSeconds: 60 },
      { id: 'post-run-3', order: 3, title: '小腿拉伸', description: '面墙弓步，后腿伸直脚跟着地，前推身体，每侧30秒。', durationSeconds: 60 },
      { id: 'post-run-4', order: 4, title: '髂胫束放松', description: '站立交叉腿，向外侧侧身延展，每侧30秒。', durationSeconds: 60 },
      { id: 'post-run-5', order: 5, title: '髋屈肌拉伸', description: '弓步跪姿，前推髋部，每侧45秒。', durationSeconds: 90 },
      { id: 'post-run-6', order: 6, title: '臀肌拉伸', description: '坐姿4字腿，身体前倾，每侧45秒。', durationSeconds: 90 }
    ]
  },
  {
    id: 'bedtime',
    title: '睡前放松',
    slug: 'bedtime',
    description: '帮助放松身心，提高睡眠质量的轻柔伸展。',
    icon: '😴',
    durationMinutes: 10,
    steps: [
      { id: 'bedtime-1', order: 1, title: '颈部放松', description: '缓慢转动头部，左右各5圈。', durationSeconds: 60 },
      { id: 'bedtime-2', order: 2, title: '肩部放松', description: '耸肩保持5秒后放松，重复8次。', durationSeconds: 60 },
      { id: 'bedtime-3', order: 3, title: '婴儿式', description: '跪坐，双臂向前延伸趴下，放松呼吸1分钟。', durationSeconds: 90 },
      { id: 'bedtime-4', order: 4, title: '仰卧扭转', description: '仰卧，双膝并拢倒向一侧，保持30秒换边。', durationSeconds: 90 },
      { id: 'bedtime-5', order: 5, title: '仰卧蝴蝶式', description: '仰卧，脚底相对，膝盖自然外展，放松1分钟。', durationSeconds: 90 },
      { id: 'bedtime-6', order: 6, title: '腿靠墙', description: '仰卧双腿靠墙垂直向上，放松呼吸2分钟。', durationSeconds: 120 }
    ]
  }
]

export function getScenarioQuickFix(slug?: string | null) {
  return SCENARIO_QUICK_FIXES.find((item) => item.slug === slug) || null
}
