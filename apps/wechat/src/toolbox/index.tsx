import { useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { ScenarioNutIcon } from '@/components/ScenarioNutIcon'
import { SCENARIO_QUICK_FIXES } from '@/constants/scenarioQuickFixes'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  getToolboxShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { PageThemeRoot } from '@/components/PageThemeRoot'

type ToolboxEntry = {
  badge: string
  description: string
  iconClass: string
  key: string
  label: string
  tags: string[]
  url: string
}

const MINI_GAMES: ToolboxEntry[] = [
  {
    badge: 'FUN CAM',
    description: '身体一动，小豆乱飞，支持保存带动画的回放视频。',
    iconClass: 'icon-star',
    key: 'motion-bean',
    label: '接豆派对',
    tags: ['30秒', '回放', '休闲'],
    url: '/toolbox/motion-bean/index'
  },
  {
    badge: 'PULLUP RUN',
    description: '像小鸟穿柱子那样过障碍，但每次上冲都要靠你的上拉动作触发。',
    iconClass: 'icon-ranking',
    key: 'pullup-rush',
    label: '引体冲刺',
    tags: ['穿缝', '上拉', '回放'],
    url: '/toolbox/pullup-rush/index'
  },
  {
    badge: 'PUSHUP DASH',
    description: '完整做一下下压再撑起，角色才会往前顶出去把墙撞开。',
    iconClass: 'icon-star',
    key: 'pushup-dash',
    label: '俯卧撑突围',
    tags: ['完整动作', '推进', '回放'],
    url: '/toolbox/pushup-dash/index'
  }
]

const PRACTICAL_TOOLS: ToolboxEntry[] = [
  {
    badge: 'VIDEO POWER',
    description: '上传动作视频，估算功率、速度和轨迹。',
    iconClass: 'icon-video',
    key: 'power-analysis',
    label: '功率视频分析',
    tags: ['速度', '功率', '轨迹'],
    url: '/toolbox/power-analysis/index'
  },
  {
    badge: 'LOAD CALC',
    description: '快速算 1RM、做组重量和训练系数。',
    iconClass: 'icon-calculator',
    key: 'strength-calculator',
    label: '力量计算器',
    tags: ['1RM', '做组', '系数'],
    url: '/streetlifting/index/calculator'
  },
  {
    badge: 'NEARBY SPOTS',
    description: '查找、分享单杠位置，顺手记录训练地点。',
    iconClass: 'icon-location',
    key: 'bar-locations',
    label: '单杠位置',
    tags: ['地图', '打点', '分享'],
    url: '/streetlifting/index/locations'
  },
  {
    badge: 'COMMUNITY LOG',
    description: '看社区成绩，也能提交和认领自己的记录。',
    iconClass: 'icon-ranking',
    key: 'community-data',
    label: '社区数据',
    tags: ['成绩', '认领', '记录'],
    url: '/streetlifting/index/data'
  }
]

function ToolboxVisual({ entryKey }: { entryKey: string }) {
  return (
    <View className={`card-visual card-visual--${entryKey}`}>
      <View className='card-visual-grid' />

      <View className='visual-pack visual-pack--motion-bean'>
        <View className='motion-bean-dot motion-bean-dot--1' />
        <View className='motion-bean-dot motion-bean-dot--2' />
        <View className='motion-bean-dot motion-bean-dot--3' />
        <View className='motion-bean-avatar' />
      </View>

      <View className='visual-pack visual-pack--pullup-rush'>
        <View className='pullup-bar pullup-bar--1' />
        <View className='pullup-bar pullup-bar--2' />
        <View className='pullup-core' />
      </View>

      <View className='visual-pack visual-pack--pushup-dash'>
        <View className='pushup-lane pushup-lane--1' />
        <View className='pushup-lane pushup-lane--2' />
        <View className='pushup-chip' />
      </View>

      <View className='visual-pack visual-pack--power-analysis'>
        <View className='power-line' />
        <View className='power-bar power-bar--1' />
        <View className='power-bar power-bar--2' />
        <View className='power-bar power-bar--3' />
      </View>

      <View className='visual-pack visual-pack--strength-calculator'>
        <View className='calc-ring' />
        <Text className='calc-tag calc-tag--1'>1RM</Text>
        <Text className='calc-tag calc-tag--2'>75%</Text>
      </View>

      <View className='visual-pack visual-pack--bar-locations'>
        <View className='location-pin' />
        <View className='location-wave location-wave--1' />
        <View className='location-wave location-wave--2' />
      </View>

      <View className='visual-pack visual-pack--community-data'>
        <View className='data-pill'>TOP</View>
        <View className='data-bar data-bar--1' />
        <View className='data-bar data-bar--2' />
        <View className='data-bar data-bar--3' />
      </View>
    </View>
  )
}

function ToolboxCard({ entry, onClick }: { entry: ToolboxEntry; onClick: (entry: ToolboxEntry) => void }) {
  return (
    <View className='toolbox-card' onClick={() => onClick(entry)}>
      <View className='card-top'>
        <View className='card-badge'>
          <Text className={`iconfont ${entry.iconClass} card-badge-icon`} />
          <Text className='card-badge-text'>{entry.badge}</Text>
        </View>
        <Text className='iconfont icon-right-arrow card-arrow' />
      </View>

      <ToolboxVisual entryKey={entry.key} />

      <Text className='card-name'>{entry.label}</Text>
      <Text className='card-desc'>{entry.description}</Text>

      <View className='card-tags'>
        {entry.tags.map((tag) => (
          <Text key={tag} className='card-tag'>
            {tag}
          </Text>
        ))}
      </View>
    </View>
  )
}

function ToolboxPage() {
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
            <View className='section-block'>
              <View className='section-header'>
                <Text className='section-title'>小游戏</Text>
                <Text className='section-subtitle'>先玩一玩，后面还能继续扩容更多玩法</Text>
              </View>
              <View className='compact-grid'>
                {MINI_GAMES.map((entry) => (
                  <ToolboxCard key={entry.key} entry={entry} onClick={handleToolClick} />
                ))}
              </View>
            </View>

            <View className='section-block'>
              <View className='section-header'>
                <Text className='section-title'>实用工具</Text>
                <Text className='section-subtitle'>继续干正事，但卡片改成更小更密一点</Text>
              </View>
              <View className='compact-grid'>
                {PRACTICAL_TOOLS.map((entry) => (
                  <ToolboxCard key={entry.key} entry={entry} onClick={handleToolClick} />
                ))}
              </View>
            </View>

            <View className='scene-section'>
              <View className='section-header'>
                <Text className='section-title'>场景放松</Text>
                <Text className='section-subtitle'>保留，但压成更轻的快速入口</Text>
              </View>
              <View className='scene-grid'>
                {SCENARIO_QUICK_FIXES.map((scenario) => (
                  <View
                    key={scenario.slug}
                    className='scene-card'
                    onClick={() => handleScenarioClick(scenario.slug)}
                  >
                    <Image className='scene-cover' src={scenario.coverImageUrl} mode='aspectFit' />
                    <View className='scene-content'>
                      <View className='scene-row'>
                        <View className='scene-icon-wrap'>
                          <ScenarioNutIcon name={scenario.icon} size={18} />
                        </View>
                        <View className='scene-texts'>
                          <Text className='scene-name'>{scenario.title}</Text>
                          <Text className='scene-desc'>{scenario.description}</Text>
                        </View>
                      </View>
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

export default ToolboxPage
