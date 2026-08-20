export type AiNavigatorTool = {
  name: string
  label: string
  description: string
  keywords: readonly string[]
  route: string
}

export type AiNavigatorResult = {
  tool: string
  confidence: number
  route: string
}

/**
 * AI 应用导航器唯一工具注册表。
 * 模型只允许从这里选择工具，route 由服务端按 name 回填，禁止相信模型生成的路径。
 */
export const AI_NAVIGATOR_TOOL_REGISTRY = [
  {
    name: 'pullup_strength_test',
    label: '引体力量测试',
    description: '测试引体向上或负重引体的力量水平，并查看评分结果',
    keywords: ['引体', '引体向上', '负重引体', '引体水平', '力量水平', '测试引体', '测引体'],
    route: '/streetlifting/index/calculator',
  },
  {
    name: 'power_analysis',
    label: '功率分析',
    description: '上传训练视频，分析动作速度、爆发力和功率表现',
    keywords: ['功率', '爆发力', '速度分析', '视频分析', '动作视频', '功率测试'],
    route: '/toolbox/power-analysis/index',
  },
  {
    name: 'one_arm_pullup_estimator',
    label: '单臂引体评估',
    description: '评估距离完成单臂引体向上还有多远',
    keywords: ['单臂引体', '单手引体', '单臂引体评估', '离单臂引体多远'],
    route: '/toolbox/one-arm-pull-up/index',
  },
  {
    name: 'today_training',
    label: '今日训练',
    description: '查看今天的训练安排、训练进度和待完成动作',
    keywords: ['今日训练', '今天练什么', '今天的训练', '训练安排', '开始今天训练'],
    route: '/pages/index/index',
  },
  {
    name: 'quick_training',
    label: '即兴训练',
    description: '不依赖训练计划，快速发起一次即兴训练',
    keywords: ['即兴训练', '快速训练', '临时训练', '随便练练', '开始训练'],
    route: '/training/impromptu-training',
  },
  {
    name: 'training_history',
    label: '训练历史',
    description: '查看过去的训练记录和完成历史',
    keywords: ['训练历史', '训练记录', '以前练了什么', '历史训练', '完成记录'],
    route: '/me/training-history/index',
  },
  {
    name: 'plan_library',
    label: '训练计划库',
    description: '查看、创建或管理自己的训练计划库',
    keywords: ['计划库', '训练计划', '我的计划', '创建计划', '管理计划'],
    route: '/me/plan-lib/index',
  },
  {
    name: 'knowledge_center',
    label: '训练知识库',
    description: '查找训练知识、文章、书籍和计划资料',
    keywords: ['训练知识', '知识库', '训练文章', '训练书籍', '学习训练'],
    route: '/content/knowledge',
  },
  {
    name: 'toolbox',
    label: '训练工具箱',
    description: '打开训练工具箱，浏览全部测试和分析工具',
    keywords: ['工具箱', '训练工具', '测试工具', '全部工具', '游戏', '玩游戏', '体感游戏', '小游戏', '好玩的训练', '放松活动'],
    route: '/toolbox/index',
  },
  {
    name: 'find_coach',
    label: '寻找教练',
    description: '发现并查看可合作的教练',
    keywords: ['找教练', '寻找教练', '教练推荐', '发现教练', '请教练', '带我练', '指导训练', '有人教我'],
    route: '/discovery/index',
  },
] as const satisfies readonly AiNavigatorTool[]

export function getAiNavigatorTool(name: string) {
  const normalizedName = String(name || '').trim()
  return AI_NAVIGATOR_TOOL_REGISTRY.find((tool) => tool.name === normalizedName) || null
}

export function isRegisteredAiNavigatorResult(result: AiNavigatorResult) {
  const tool = getAiNavigatorTool(result.tool)
  return Boolean(tool && tool.route === result.route)
}
