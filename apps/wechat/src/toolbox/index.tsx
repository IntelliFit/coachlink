import { useEffect, useMemo } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { ScenarioNutIcon } from '@/components/ScenarioNutIcon'
import { SCENARIO_QUICK_FIXES } from '@/constants/scenarioQuickFixes'
import { useTheme } from '@/hooks/useTheme'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  getToolboxShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'

type ToolboxEntry = {
  badge: string
  description: string
  iconClass: string
  key: string
  label: string
  tags: string[]
  url: string
}

const FEATURED_TOOL: ToolboxEntry = {
  badge: '本周主推',
  description: '用体重和严格负重引体 1RM 测算单引距离，并获得当前阶段的 8 周简易计划。',
  iconClass: 'icon-ranking',
  key: 'one-arm-pull-up',
  label: '离单手引体还有多远',
  tags: ['测算差距', '分级结果', '8 周计划'],
  url: '/toolbox/one-arm-pull-up/index'
}

const MINI_GAMES: ToolboxEntry[] = [
  {
    badge: '手指互动',
    description: '伸出几根手指，光膜就跟着变化，生成可分享的特效视频。',
    iconClass: 'icon-star',
    key: 'motion-effects',
    label: '手指光膜',
    tags: ['动态指尖', '可分享'],
    url: '/toolbox/motion-effects/index'
  },
  {
    badge: '体感休闲',
    description: '身体一动，小豆乱飞，保存带动画的回放视频。',
    iconClass: 'icon-star',
    key: 'motion-bean',
    label: '接豆派对',
    tags: ['30 秒', '回放'],
    url: '/toolbox/motion-bean/index'
  },
  {
    badge: '引体玩法',
    description: '每次上冲都靠你的上拉动作触发，穿过障碍。',
    iconClass: 'icon-ranking',
    key: 'pullup-rush',
    label: '引体冲刺',
    tags: ['上拉', '闯关'],
    url: '/toolbox/pullup-rush/index'
  },
  {
    badge: '俯卧撑玩法',
    description: '完整做一下下压再撑起，推动角色撞开墙壁。',
    iconClass: 'icon-star',
    key: 'pushup-dash',
    label: '俯卧撑突围',
    tags: ['完整动作', '闯关'],
    url: '/toolbox/pushup-dash/index'
  }
]

const PRACTICAL_TOOLS: ToolboxEntry[] = [
  {
    badge: '视频分析',
    description: '上传动作视频，估算功率、速度和轨迹。',
    iconClass: 'icon-video',
    key: 'power-analysis',
    label: '功率视频分析',
    tags: ['速度', '功率'],
    url: '/toolbox/power-analysis/index'
  },
  {
    badge: '力量测算',
    description: '快速算 1RM、做组重量和训练系数。',
    iconClass: 'icon-calculator',
    key: 'strength-calculator',
    label: '力量计算器',
    tags: ['1RM', '做组'],
    url: '/streetlifting/index/calculator'
  },
  {
    badge: '训练地图',
    description: '查找、分享单杠位置，记录训练地点。',
    iconClass: 'icon-location',
    key: 'bar-locations',
    label: '单杠位置',
    tags: ['地图', '分享'],
    url: '/streetlifting/index/locations'
  },
  {
    badge: '街举社区',
    description: '查看社区成绩，提交和认领自己的记录。',
    iconClass: 'icon-ranking',
    key: 'community-data',
    label: '社区数据',
    tags: ['成绩', '记录'],
    url: '/streetlifting/index/data'
  }
]

function ToolboxCard({
  entry,
  onClick
}: {
  entry: ToolboxEntry
  onClick: (entry: ToolboxEntry) => void
}) {
  return (
    <View className={`toolbox-card toolbox-card--${entry.key}`} onClick={() => onClick(entry)}>
      <View className='toolbox-card-top'>
        <View className='toolbox-icon'>
          <Text className={`iconfont ${entry.iconClass}`} />
        </View>
        <Text className='toolbox-arrow'>→</Text>
      </View>
      <Text className='toolbox-badge'>{entry.badge}</Text>
      <Text className='toolbox-name'>{entry.label}</Text>
      <Text className='toolbox-desc'>{entry.description}</Text>
      <View className='toolbox-tags'>
        {entry.tags.map((tag) => (
          <Text key={tag} className='toolbox-tag'>
            {tag}
          </Text>
        ))}
      </View>
    </View>
  )
}

export default function ToolboxPage() {
  const { effectiveTheme } = useTheme()
  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: getToolboxShareTitle(),
        path: buildSharePath('/toolbox/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  const handleToolClick = (entry: ToolboxEntry) => {
    Taro.navigateTo({ url: entry.url })
  }

  const handleScenarioClick = (slug: string) => {
    Taro.navigateTo({ url: `/toolbox/scenario/index?slug=${slug}` })
  }

  return (
    <PageThemeRoot>
      <View className={`toolbox-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='toolbox-hero'>
              <Text className='hero-kicker'>COACHLINK LAB</Text>
              <Text className='hero-title'>把训练问题，变成一个个简单答案</Text>
              <Text className='hero-desc'>测力量、玩动作、找场地，也照顾训练后的身体。</Text>
              <View className='hero-stats'>
                <Text>{1 + MINI_GAMES.length + PRACTICAL_TOOLS.length} 个训练工具</Text>
                <Text>{SCENARIO_QUICK_FIXES.length} 个恢复场景</Text>
                <Text>随开随用</Text>
              </View>
            </View>

            <View className='featured-section'>
              <View className='section-header'>
                <Text className='section-kicker'>本周主推</Text>
                <Text className='section-title'>先知道自己在哪，再决定怎么练</Text>
              </View>
              <View className='featured-card' onClick={() => handleToolClick(FEATURED_TOOL)}>
                <View className='featured-copy'>
                  <View className='featured-icon'>
                    <Text className={`iconfont ${FEATURED_TOOL.iconClass}`} />
                  </View>
                  <Text className='featured-name'>{FEATURED_TOOL.label}</Text>
                  <Text className='featured-desc'>{FEATURED_TOOL.description}</Text>
                  <View className='featured-tags'>
                    {FEATURED_TOOL.tags.map((tag) => (
                      <Text key={tag}>{tag}</Text>
                    ))}
                  </View>
                </View>
                <View className='featured-metric'>
                  <Text className='featured-metric-label'>经验门槛</Text>
                  <Text className='featured-metric-value'>0.8×</Text>
                  <Text className='featured-metric-desc'>外加重量 / 体重</Text>
                  <View className='featured-action'>
                    <Text>开始测算</Text>
                    <Text>→</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className='section-block'>
              <View className='section-header'>
                <Text className='section-kicker'>体感小游戏</Text>
                <Text className='section-title'>动一动，开一局</Text>
                <Text className='section-subtitle'>使用摄像头识别动作，支持保存回放。</Text>
              </View>
              <View className='toolbox-grid'>
                {MINI_GAMES.map((entry) => (
                  <ToolboxCard key={entry.key} entry={entry} onClick={handleToolClick} />
                ))}
              </View>
            </View>

            <View className='section-block'>
              <View className='section-header'>
                <Text className='section-kicker'>分析与探索</Text>
                <Text className='section-title'>再挑一个趁手工具</Text>
              </View>
              <View className='toolbox-grid'>
                {PRACTICAL_TOOLS.map((entry) => (
                  <ToolboxCard key={entry.key} entry={entry} onClick={handleToolClick} />
                ))}
              </View>
            </View>

            <View className='scene-section'>
              <View className='section-header'>
                <Text className='section-kicker'>身体恢复</Text>
                <Text className='section-title'>不训练的时候，也可以照顾身体</Text>
                <Text className='section-subtitle'>不需要器械，跟着步骤慢慢完成。</Text>
              </View>
              <View className='scene-grid'>
                {SCENARIO_QUICK_FIXES.map((scenario) => (
                  <View
                    key={scenario.slug}
                    className='scene-card'
                    onClick={() => handleScenarioClick(scenario.slug)}
                  >
                    <View className='scene-cover-wrap'>
                      <Image className='scene-cover' src={scenario.coverImageUrl} mode='aspectFit' />
                      <View className='scene-icon-wrap'>
                        <ScenarioNutIcon name={scenario.icon} size={18} />
                      </View>
                    </View>
                    <View className='scene-body'>
                      <Text className='scene-name'>{scenario.title}</Text>
                      <Text className='scene-desc'>{scenario.description}</Text>
                      <Text className='scene-meta'>约 {scenario.durationMinutes} 分钟</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    </PageThemeRoot>
  )
}
