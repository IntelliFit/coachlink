import { useEffect, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { SCENARIO_QUICK_FIXES } from '@/constants/scenarioQuickFixes'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  getToolboxShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'

const TOOLBOX_LINKS = [
  {
    key: 'strength-calculator',
    label: '力量计算器',
    description: '小程序内完整实现，与网页端逻辑一致',
    icon: '🧮',
    url: '/streetlifting/index/calculator'
  },
  {
    key: 'bar-locations',
    label: '单杠位置',
    description: '查找、分享单杠位置，支持上传图片',
    icon: '📍',
    url: '/streetlifting/index/locations'
  },
  {
    key: 'community-data',
    label: '社区数据',
    description: '查看与提交街健力量数据，支持认领',
    icon: '📊',
    url: '/streetlifting/index/data'
  }
]

function ToolboxPage() {
  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: getToolboxShareTitle(),
        path: buildSharePath('/me/toolbox/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  const handleToolClick = (tool: typeof TOOLBOX_LINKS[0]) => {
    Taro.navigateTo({ url: tool.url })
  }

  const handleScenarioClick = (slug: string) => {
    Taro.navigateTo({ url: `/me/toolbox/scenario/index?slug=${slug}` })
  }

  return (
    <View className='toolbox-page'>
      <ScrollView className='page-scroll' scrollY>
        <View className='page-content'>
          <View className='page-header'>
            <View className='header-left'>
              <View className='header-icon'>✨</View>
              <View>
                <Text className='page-title'>工具箱</Text>
                <Text className='page-subtitle'>挑一个工具立刻试试</Text>
              </View>
            </View>
            <Button className='share-btn' openType='share'>
              <Text>分享</Text>
            </Button>
          </View>

          <View className='hero-section'>
            <View className='hero-badge'>
              <Text>✨ {TOOLBOX_LINKS.length} 个工具 + {SCENARIO_QUICK_FIXES.length} 个场景急救箱</Text>
            </View>
            <Text className='hero-title'>让训练更"可量化、可分享、可传播"</Text>
            <Text className='hero-desc'>
              一边是计算与数据工具，一边是按场景直接可用的急救方案，后者已从 Web 端开始迁入小程序。
            </Text>
          </View>

          <View className='tools-grid'>
            {TOOLBOX_LINKS.map((tool) => (
              <View 
                key={tool.key} 
                className='tool-card'
                onClick={() => handleToolClick(tool)}
              >
                <View className='tool-header'>
                  <View className='tool-icon'>{tool.icon}</View>
                  <Text className='tool-arrow'>→</Text>
                </View>
                <Text className='tool-name'>{tool.label}</Text>
                {tool.description && (
                  <Text className='tool-desc'>{tool.description}</Text>
                )}
                <View className='tool-actions'>
                  <View className='tool-btn'>
                    <Text>打开</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View className='scene-section'>
            <View className='scene-header'>
              <Text className='scene-title'>场景急救箱</Text>
              <Text className='scene-subtitle'>不需要先懂体系，直接按情境开始</Text>
            </View>
            <View className='scene-grid'>
              {SCENARIO_QUICK_FIXES.map((scenario) => (
                <View
                  key={scenario.slug}
                  className='scene-card'
                  onClick={() => handleScenarioClick(scenario.slug)}
                >
                  <Text className='scene-icon'>{scenario.icon}</Text>
                  <Text className='scene-name'>{scenario.title}</Text>
                  <Text className='scene-desc'>{scenario.description}</Text>
                  <Text className='scene-meta'>约 {scenario.durationMinutes} 分钟</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default ToolboxPage
