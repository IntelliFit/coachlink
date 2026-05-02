export interface ScenarioQuickFixStep {
  id: string
  order: number
  title: string
  description: string
  durationSeconds: number
  imageUrl: string
}

export type ScenarioQuickFixIcon = 'User' | 'Location' | 'Target' | 'Heart'

export interface ScenarioQuickFix {
  id: string
  title: string
  slug: string
  description: string
  icon: ScenarioQuickFixIcon
  durationMinutes: number
  coverImageUrl: string
  steps: ScenarioQuickFixStep[]
}

const SCENARIO_IMAGE_BASE = '/me/assets/images/toolbox-scenarios'

export const SCENARIO_QUICK_FIXES: ScenarioQuickFix[] = [
  {
    id: 'office-neck',
    title: '办公后肩颈放松',
    slug: 'office-neck',
    description: '适合久坐办公、低头看电脑后肩颈发紧的时候，用几步温和动作把后颈、肩侧和上背慢慢松开。',
    icon: 'User',
    durationMinutes: 5,
    coverImageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-1.jpg`,
    steps: [
      {
        id: 'office-neck-1',
        order: 1,
        title: '坐姿下巴微收',
        description: '坐稳后把头顶轻轻向上延展，下巴微微回收，不要低头含胸。感受后颈像被轻轻拉长一样，呼吸保持放松。',
        durationSeconds: 90,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-1.jpg`
      },
      {
        id: 'office-neck-2',
        order: 2,
        title: '颈侧轻柔拉伸',
        description: '头部慢慢倒向一侧，另一边肩膀保持下沉，不要跟着抬起。停留时只要有轻微拉伸感就够了，换边时也保持慢慢来。',
        durationSeconds: 90,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-2.jpg`
      },
      {
        id: 'office-neck-3',
        order: 3,
        title: '肩部后绕放松',
        description: '双肩向上、向后、再向下缓慢绕环，把动作做圆但不要做快。重点是把肩颈的紧绷感一点点卸下来。',
        durationSeconds: 120,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-3.jpg`
      }
    ]
  },
  {
    id: 'sitting-back',
    title: '久坐后腰背舒展',
    slug: 'sitting-back',
    description: '适合久坐之后腰背发僵、起身时觉得身体打不开的时候，先把背部延展开，再做温和活动和收尾放松。',
    icon: 'Location',
    durationMinutes: 6,
    coverImageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-4.jpg`,
    steps: [
      {
        id: 'sitting-back-1',
        order: 1,
        title: '站姿扶墙延展',
        description: '双手扶稳支撑面，慢慢把髋部向后送出去，让手臂和背部自然拉长。不要塌腰，用“拉长”而不是“硬压”的感觉开始。',
        durationSeconds: 120,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-4.jpg`
      },
      {
        id: 'sitting-back-2',
        order: 2,
        title: '猫牛式舒展',
        description: '四点支撑后，随着呼吸慢慢拱背，再慢慢回到伸展位。动作范围不用很大，重点是让整条脊柱重新活动起来。',
        durationSeconds: 120,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-5.jpg`
      },
      {
        id: 'sitting-back-3',
        order: 3,
        title: '仰卧抱膝放松',
        description: '躺下后把膝盖轻轻带向身体，手臂只是辅助，不要用力猛拉。让下背部慢慢松下来，呼吸越平稳越好。',
        durationSeconds: 120,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-6.jpg`
      }
    ]
  },
  {
    id: 'post-run',
    title: '跑步后下肢拉伸',
    slug: 'post-run',
    description: '适合跑步、跳绳或下肢训练后做恢复，按顺序放松小腿、大腿前侧和髋臀区域，让腿部紧绷感慢慢退下来。',
    icon: 'Target',
    durationMinutes: 8,
    coverImageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-7.jpg`,
    steps: [
      {
        id: 'post-run-1',
        order: 1,
        title: '小腿后侧拉伸',
        description: '弓步站稳后让后脚脚跟贴地，身体轻轻往前送一点。你应该感觉到小腿后侧被拉开，而不是脚踝被硬顶住。',
        durationSeconds: 150,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-7.jpg`
      },
      {
        id: 'post-run-2',
        order: 2,
        title: '大腿前侧拉伸',
        description: '先扶稳再拉伸，轻轻把脚跟带向臀部，膝盖尽量朝下。重点放在大腿前侧的舒展感，不要为了拉更深而扭腰。',
        durationSeconds: 150,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-8.jpg`
      },
      {
        id: 'post-run-3',
        order: 3,
        title: '臀部与髋部放松',
        description: '进入臀部和髋部的放松姿势后，先找到稳定，再慢慢加一点点幅度。只保留温和拉伸感，不需要追求压到底。',
        durationSeconds: 180,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-9.jpg`
      }
    ]
  },
  {
    id: 'bedtime',
    title: '睡前放松',
    slug: 'bedtime',
    description: '适合睡前十分钟做一个简单收尾，把呼吸、背部和神经状态一起慢慢放下来，让身体更容易进入休息节奏。',
    icon: 'Heart',
    durationMinutes: 10,
    coverImageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-10.jpg`,
    steps: [
      {
        id: 'bedtime-1',
        order: 1,
        title: '仰卧腹式呼吸',
        description: '平躺后把注意力放到呼吸上，吸气时感受腹部轻轻鼓起，呼气时慢慢落下。先不要着急拉伸，先把节奏放慢。',
        durationSeconds: 180,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-10.jpg`
      },
      {
        id: 'bedtime-2',
        order: 2,
        title: '仰卧扭转舒展',
        description: '双膝并拢倒向一侧时，肩膀尽量保持放松，不需要为了贴地而强压。让腰背和侧腰在呼吸里慢慢打开就可以。',
        durationSeconds: 180,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-11.jpg`
      },
      {
        id: 'bedtime-3',
        order: 3,
        title: '婴儿式放松',
        description: '最后用一个更安静的姿势收尾，臀部坐回脚跟，手臂向前延展，背部自然松下来。让身体知道现在可以慢慢休息了。',
        durationSeconds: 240,
        imageUrl: `${SCENARIO_IMAGE_BASE}/first-aid-12.jpg`
      }
    ]
  }
]

export function getScenarioQuickFix(slug?: string | null) {
  return SCENARIO_QUICK_FIXES.find((item) => item.slug === slug) || null
}
