import { useEffect, useMemo } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import motionBeanCover from '@/assets/images/toolbox-games/motion-bean-game-v2.webp'
import motionEffectsCover from '@/assets/images/toolbox-games/motion-effects-game-v2.webp'
import pullupRushCover from '@/assets/images/toolbox-games/pullup-rush-game-v2.webp'
import pushupDashCover from '@/assets/images/toolbox-games/pushup-dash-game-v2.webp'
import BottomNav from '@/components/BottomNav'
import { PageThemeRoot } from '@/components/PageThemeRoot'
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
  cover?: string
  description: string
  iconClass: string
  key: string
  label: string
  tags: string[]
  url: string
}

const MINI_GAMES: ToolboxEntry[] = [
  {
    badge: '手指互动',
    cover: motionEffectsCover,
    description: '伸出几根手指，光膜就跟着变化，生成可分享的特效视频。',
    iconClass: 'icon-star',
    key: 'motion-effects',
    label: '手指光膜',
    tags: ['动态指尖', '可分享'],
    url: '/toolbox/motion-effects/index'
  },
  {
    badge: '体感休闲',
    cover: motionBeanCover,
    description: '身体一动，小豆乱飞，保存带动画的回放视频。',
    iconClass: 'icon-star',
    key: 'motion-bean',
    label: '接豆派对',
    tags: ['30 秒', '回放'],
    url: '/toolbox/motion-bean/index'
  },
  {
    badge: '引体玩法',
    cover: pullupRushCover,
    description: '每次上冲都靠你的上拉动作触发，穿过障碍。',
    iconClass: 'icon-ranking',
    key: 'pullup-rush',
    label: '引体冲刺',
    tags: ['上拉', '闯关'],
    url: '/toolbox/pullup-rush/index'
  },
  {
    badge: '俯卧撑玩法',
    cover: pushupDashCover,
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
    badge: '能力测算',
    description: '根据体重和负重引体能力，看看离单手引体还有多远。',
    iconClass: 'icon-ranking',
    key: 'one-arm-pull-up',
    label: '单手引体测算',
    tags: ['能力差距', '训练建议'],
    url: '/toolbox/one-arm-pull-up/index'
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
  compact = false,
  entry,
  onClick
}: {
  compact?: boolean
  entry: ToolboxEntry
  onClick: (entry: ToolboxEntry) => void
}) {
  if (compact) {
    return (
      <View
        className={`toolbox-card toolbox-card--compact toolbox-card--${entry.key}`}
        onClick={() => onClick(entry)}
      >
        <View className='toolbox-card-main'>
          <View className='toolbox-icon'>
            <Text className={`iconfont ${entry.iconClass}`} />
          </View>
          <View className='toolbox-card-copy'>
            <Text className='toolbox-badge'>{entry.badge}</Text>
            <Text className='toolbox-name'>{entry.label}</Text>
            <Text className='toolbox-desc'>{entry.description}</Text>
          </View>
          <Text className='toolbox-arrow'>→</Text>
        </View>
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

  return (
    <View
      className={`toolbox-card toolbox-card--game toolbox-card--${entry.key}`}
      onClick={() => onClick(entry)}
    >
      <View className='toolbox-cover-shell'>
        {entry.cover ? (
          <Image className='toolbox-cover' src={entry.cover} mode='aspectFill' lazyLoad />
        ) : null}
        <View className='toolbox-cover-scrim' />
        <Text className='toolbox-cover-title'>{entry.label}</Text>
      </View>
    </View>
  )
}

export default function ToolboxPage() {
  const { effectiveTheme } = useTheme()
  const pageTopPadding = useMemo(() => {
    try {
      const menuButtonRect = Taro.getMenuButtonBoundingClientRect()
      if (menuButtonRect?.bottom) {
        return `${menuButtonRect.bottom + 8}px`
      }
    } catch {
      // Fall back to a conservative custom-navigation safe area.
    }

    return '112rpx'
  }, [])
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

  return (
    <PageThemeRoot>
      <View className={`toolbox-page theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content' style={{ paddingTop: pageTopPadding }}>
            <View className='toolbox-hero'>
              <Text className='hero-kicker'>训练辅助</Text>
              <Text className='hero-title'>工具箱</Text>
              <Text className='hero-meta'>
                {MINI_GAMES.length + PRACTICAL_TOOLS.length} 个训练工具 · 随开随用
              </Text>
              <Text className='hero-desc'>测算、分析和互动，把训练里的小问题快速解决。</Text>
            </View>
            <View className='section-block'>
              <View className='section-header'>
                <Text className='section-kicker'>体感小游戏 · {MINI_GAMES.length}</Text>
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
                <Text className='section-kicker'>实用工具 · {PRACTICAL_TOOLS.length}</Text>
                <Text className='section-title'>算一算、看一看、找一找</Text>
                <Text className='section-subtitle'>训练中常用的小工具，都放在这里。</Text>
              </View>
              <View className='toolbox-list'>
                {PRACTICAL_TOOLS.map((entry) => (
                  <ToolboxCard
                    key={entry.key}
                    compact
                    entry={entry}
                    onClick={handleToolClick}
                  />
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
