import { useEffect, useMemo, useState } from 'react'
import { WECHAT_FREE_RELEASE } from '@coachlink/core'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import motionBeanCover from '@/assets/images/toolbox-games/motion-bean-game-v2.webp'
import motionEffectsCover from '@/assets/images/toolbox-games/motion-effects-game-v2.webp'
import pullupRushCover from '@/assets/images/toolbox-games/pullup-rush-game-v2.webp'
import pushupDashCover from '@/assets/images/toolbox-games/pushup-dash-game-v2.webp'
import barLocationsCover from '@/assets/images/toolbox-practical/practical-bar-locations-v2.webp'
import communityDataCover from '@/assets/images/toolbox-practical/practical-community-data-v2.webp'
import oneArmPullUpCover from '@/assets/images/toolbox-practical/practical-one-arm-pull-up-v2.webp'
import powerAnalysisCover from '@/assets/images/toolbox-practical/practical-power-analysis-v2.webp'
import strengthCalculatorCover from '@/assets/images/toolbox-practical/practical-strength-calculator-v2.webp'
import BottomNav from '@/components/BottomNav'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { ClPageHeader, ClSectionHeader } from '@/components/ui'
import { useTheme } from '@/hooks/useTheme'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  getToolboxShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import { readRecentToolKeys, rememberToolKey } from './toolboxRecent'
import './index.scss'

type ToolboxEntry = {
  cover: string
  description: string
  key: string
  label: string
  url: string
  /** Shown on the cover when the tool cannot be used in this release. */
  unavailableLabel?: string
}

const FEATURED_TOOL: ToolboxEntry = {
  cover: powerAnalysisCover,
  description: '上传训练视频，估算功率、速度和轨迹',
  key: 'power-analysis',
  label: '功率视频分析',
  url: '/toolbox/power-analysis/index'
}

const PRACTICAL_TOOLS: ToolboxEntry[] = [
  {
    cover: strengthCalculatorCover,
    description: '1RM、力量分和做组重量',
    key: 'strength-calculator',
    label: '力量计算器',
    url: '/streetlifting/index/calculator'
  },
  {
    cover: oneArmPullUpCover,
    description: '离单手引体还有多远',
    key: 'one-arm-pull-up',
    label: '单手引体测算',
    url: '/toolbox/one-arm-pull-up/index'
  },
  {
    cover: barLocationsCover,
    description: '找附近的单杠双杠',
    key: 'bar-locations',
    label: '单杠位置',
    url: '/streetlifting/index/locations'
  },
  {
    cover: communityDataCover,
    description: '社区成绩与排名',
    key: 'community-data',
    label: '社区数据',
    url: '/streetlifting/index/data'
  }
]

const MINI_GAMES: ToolboxEntry[] = [
  {
    cover: pullupRushCover,
    description: '上拉带小鸟穿过障碍',
    key: 'pullup-rush',
    label: '引体冲刺',
    url: '/toolbox/pullup-rush/index'
  },
  {
    cover: pushupDashCover,
    description: '完整俯卧撑撞开墙壁',
    key: 'pushup-dash',
    label: '俯卧撑突围',
    url: '/toolbox/pushup-dash/index'
  },
  {
    cover: motionBeanCover,
    description: '身体一动接住小豆',
    key: 'motion-bean',
    label: '接豆派对',
    url: '/toolbox/motion-bean/index'
  },
  {
    cover: motionEffectsCover,
    description: '手指控制光膜特效',
    key: 'motion-effects',
    label: '手指光膜',
    url: '/toolbox/motion-effects/index',
    unavailableLabel: WECHAT_FREE_RELEASE ? '暂未开放' : undefined
  }
]

const ALL_ENTRIES = [FEATURED_TOOL, ...PRACTICAL_TOOLS, ...MINI_GAMES]
const ENTRY_BY_KEY = new Map(ALL_ENTRIES.map((entry) => [entry.key, entry]))
const AVAILABLE_COUNT = ALL_ENTRIES.filter((entry) => !entry.unavailableLabel).length

export default function ToolboxPage() {
  const { effectiveTheme } = useTheme()
  const [recentKeys, setRecentKeys] = useState<string[]>([])
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

  useDidShow(() => {
    setRecentKeys(readRecentToolKeys(ALL_ENTRIES.map((entry) => entry.key)))
  })

  const openTool = (entry: ToolboxEntry) => {
    setRecentKeys(rememberToolKey(entry.key))
    Taro.navigateTo({ url: entry.url })
  }

  const recentEntries = recentKeys
    .map((key) => ENTRY_BY_KEY.get(key))
    .filter((entry): entry is ToolboxEntry => Boolean(entry))

  return (
    <PageThemeRoot>
      <View className={`toolbox-page theme-${effectiveTheme}`}>
        <ScrollView className='toolbox-scroll' scrollY>
          <ClPageHeader title='工具箱'>
            <Text className='toolbox-count cl-num'>{AVAILABLE_COUNT} 个训练工具</Text>
            {recentEntries.length > 0 ? (
              <View className='toolbox-recent'>
                <Text className='toolbox-recent__label'>最近用过</Text>
                {recentEntries.map((entry) => (
                  <View key={entry.key} className='toolbox-recent__chip' onClick={() => openTool(entry)}>
                    <Text className='toolbox-recent__chip-text'>{entry.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ClPageHeader>

          <View className='toolbox-body'>
            <View className='toolbox-section'>
              <ClSectionHeader title='实用工具' meta={String(PRACTICAL_TOOLS.length + 1)} />
              <View className='toolbox-featured' onClick={() => openTool(FEATURED_TOOL)}>
                <Image className='toolbox-featured__cover' src={FEATURED_TOOL.cover} mode='aspectFill' lazyLoad />
                <View className='toolbox-label toolbox-label--featured'>
                  <Text className='toolbox-label__name'>{FEATURED_TOOL.label}</Text>
                  <Text className='toolbox-label__desc'>{FEATURED_TOOL.description}</Text>
                </View>
              </View>
              <View className='toolbox-grid'>
                {PRACTICAL_TOOLS.map((entry) => (
                  <View key={entry.key} className='toolbox-tile' onClick={() => openTool(entry)}>
                    <Image className='toolbox-tile__cover' src={entry.cover} mode='aspectFill' lazyLoad />
                    <View className='toolbox-label'>
                      <Text className='toolbox-label__name'>{entry.label}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View className='toolbox-section'>
              <View className='toolbox-section__head'>
                <ClSectionHeader title='体感小游戏' meta={String(MINI_GAMES.length)} />
                <Text className='toolbox-section__hint'>摄像头识别动作</Text>
              </View>
              <ScrollView className='toolbox-games' scrollX enhanced showScrollbar={false}>
                <View className='toolbox-games__track'>
                  {MINI_GAMES.map((entry) => (
                    <View key={entry.key} className='toolbox-game' onClick={() => openTool(entry)}>
                      <View className='toolbox-game__cover-wrap'>
                        <Image className='toolbox-game__cover' src={entry.cover} mode='aspectFill' lazyLoad />
                        {entry.unavailableLabel ? (
                          <Text className='toolbox-game__badge'>{entry.unavailableLabel}</Text>
                        ) : null}
                      </View>
                      <Text className='toolbox-game__name'>{entry.label}</Text>
                      <Text className='toolbox-game__desc'>{entry.description}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    </PageThemeRoot>
  )
}
