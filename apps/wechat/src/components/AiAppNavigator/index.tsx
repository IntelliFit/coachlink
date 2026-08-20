import React, { useEffect, useState } from 'react'
import { Button, Text, Textarea, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ArrowUp, LoaderCircle, Sparkles, X } from 'lucide-react'
import {
  getAiNavigatorTool,
  isRegisteredAiNavigatorResult,
  type AiNavigatorTool,
  type AiNavigatorResult,
} from '@coachlink/core'
import Icon from '@/components/Icon'
import { aiNavigatorService } from '@/services/aiNavigatorService'
import { authService } from '@/services/authService'
import './index.scss'

const MIN_NAVIGATION_CONFIDENCE = 0.5
const MAX_QUERY_LENGTH = 160

const HIDDEN_ROUTE_PREFIXES = [
  '/auth',
  '/common/common/video-player',
  '/me/payment/webview',
  '/toolbox/motion-bean',
  '/toolbox/motion-effects',
  '/toolbox/pullup-rush',
  '/toolbox/pushup-dash',
  '/toolbox/scenario',
  '/training/training-execution',
]

function normalizePath(route: string) {
  if (!route) return ''
  const path = route.startsWith('/') ? route : `/${route}`
  return path.replace(/\/+$/, '')
}

function getCurrentPath() {
  const pages = Taro.getCurrentPages()
  if (pages.length === 0) return ''
  return normalizePath((pages[pages.length - 1] as { route?: string }).route || '')
}

function shouldHideOnRoute(route: string) {
  return HIDDEN_ROUTE_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))
}

function getValidatedTool(result: AiNavigatorResult) {
  if (result.confidence < MIN_NAVIGATION_CONFIDENCE || !isRegisteredAiNavigatorResult(result)) {
    return null
  }
  return getAiNavigatorTool(result.tool)
}

export default function AiAppNavigator() {
  const [isOpen, setIsOpen] = useState(false)
  const [isHidden, setIsHidden] = useState(() => shouldHideOnRoute(getCurrentPath()))
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [suggestedTool, setSuggestedTool] = useState<AiNavigatorTool | null>(null)

  const syncRouteVisibility = () => {
    const hidden = shouldHideOnRoute(getCurrentPath())
    setIsHidden(hidden)
    if (hidden) setIsOpen(false)
  }

  useEffect(() => {
    syncRouteVisibility()
  }, [])

  useDidShow(() => {
    syncRouteVisibility()
  })

  const closePanel = () => {
    if (isLoading) return
    setIsOpen(false)
    setFeedback('')
    setSuggestedTool(null)
    Taro.hideKeyboard()
  }

  const openPanel = async () => {
    if (!authService.isAuthenticated()) {
      const modal = await Taro.showModal({
        title: '登录后使用 AI 导航',
        content: '登录后描述目标，我会先推荐功能，由你确认后再打开。',
        confirmText: '去登录',
        cancelText: '暂不',
      })
      if (modal.confirm) {
        await Taro.navigateTo({ url: authService.buildLoginUrl(getCurrentPath()) })
      }
      return
    }
    setFeedback('')
    setSuggestedTool(null)
    setIsOpen(true)
  }

  const navigateToTool = async (tool: AiNavigatorTool) => {
    if (getCurrentPath() === normalizePath(tool.route)) {
      setIsOpen(false)
      setQuery('')
      Taro.hideKeyboard()
      Taro.showToast({ title: '你已经在这个功能页', icon: 'none' })
      return
    }

    await Taro.navigateTo({ url: tool.route })
    setIsOpen(false)
    setQuery('')
    setFeedback('')
    Taro.hideKeyboard()
  }

  const presentNavigationSuggestion = (result: AiNavigatorResult) => {
    const tool = getValidatedTool(result)
    if (!tool) {
      setSuggestedTool(null)
      setFeedback('暂时没找到对应功能，请换一种更具体的说法')
      return
    }
    setSuggestedTool(tool)
    setFeedback('')
    Taro.hideKeyboard()
  }

  const handleConfirmNavigation = async () => {
    if (!suggestedTool || isLoading) return
    try {
      await navigateToTool(suggestedTool)
    } catch (error) {
      console.error('[ai-app-navigator] confirmed navigation failed:', error)
      setFeedback('页面暂时无法打开，请稍后重试')
    }
  }

  const handleSubmit = async () => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery || isLoading) {
      if (!normalizedQuery) setFeedback('请先描述你想完成的事情')
      return
    }

    setSuggestedTool(null)
    setIsLoading(true)
    setFeedback('正在匹配最合适的功能…')
    try {
      const response = await aiNavigatorService.recognizeIntent(normalizedQuery)
      if (!response.success || !response.data) {
        setFeedback(response.message || 'AI 导航暂时不可用，请稍后重试')
        return
      }
      presentNavigationSuggestion(response.data)
    } catch (error) {
      console.error('[ai-app-navigator] navigate failed:', error)
      setFeedback('页面暂时无法打开，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  if (isHidden) return null

  return (
    <View className='ai-app-navigator'>
      {isOpen ? (
        <View className='ai-app-navigator__backdrop' onClick={closePanel}>
          <View
            className='ai-app-navigator__panel'
            onClick={(event) => event.stopPropagation()}
          >
            <View className='ai-app-navigator__header'>
              <View className='ai-app-navigator__heading'>
                <View className='ai-app-navigator__mark' aria-hidden>
                  <Icon component={Sparkles} size={20} color='#CF6D4E' strokeWidth={2} />
                </View>
                <View>
                  <Text className='ai-app-navigator__title'>想去哪里？</Text>
                  <Text className='ai-app-navigator__subtitle'>说得模糊也可以，我会先推荐，再由你确认</Text>
                </View>
              </View>
              <Button
                className='ai-app-navigator__close'
                aria-label='关闭 AI 导航'
                disabled={isLoading}
                hoverClass='ai-app-navigator__close--pressed'
                onClick={closePanel}
              >
                <Icon component={X} size={20} color='currentColor' strokeWidth={2} />
              </Button>
            </View>

            <Text className='ai-app-navigator__label'>描述你想完成的事情</Text>
            <Textarea
              className='ai-app-navigator__input'
              value={query}
              placeholder='例如：我想玩游戏，或者想测测爆发力'
              maxlength={MAX_QUERY_LENGTH}
              focus
              autoHeight
              showConfirmBar={false}
              cursorSpacing={32}
              disabled={isLoading}
              onInput={(event) => {
                setQuery(event.detail.value)
                if (suggestedTool) setSuggestedTool(null)
                if (feedback) setFeedback('')
              }}
              onConfirm={handleSubmit}
            />

            <View className='ai-app-navigator__meta'>
              <Text
                className={`ai-app-navigator__feedback ${feedback && !isLoading ? 'ai-app-navigator__feedback--error' : ''}`}
              >
                {feedback || '这是应用导航，不会开启聊天会话'}
              </Text>
              <Text className='ai-app-navigator__count'>{query.length}/{MAX_QUERY_LENGTH}</Text>
            </View>

            {suggestedTool && (
              <View className='ai-app-navigator__suggestion'>
                <Text className='ai-app-navigator__suggestion-eyebrow'>AI 推荐</Text>
                <Text className='ai-app-navigator__suggestion-title'>{suggestedTool.label}</Text>
                <Text className='ai-app-navigator__suggestion-description'>{suggestedTool.description}</Text>
                <Text className='ai-app-navigator__suggestion-note'>只有点击“确认前往”后才会打开该功能</Text>
                <View className='ai-app-navigator__suggestion-actions'>
                  <Button
                    className='ai-app-navigator__suggestion-dismiss'
                    aria-label='取消当前推荐并重新描述'
                    hoverClass='ai-app-navigator__suggestion-dismiss--pressed'
                    onClick={() => setSuggestedTool(null)}
                  >
                    重新描述
                  </Button>
                  <Button
                    className='ai-app-navigator__suggestion-confirm'
                    aria-label={`确认前往${suggestedTool.label}`}
                    hoverClass='ai-app-navigator__suggestion-confirm--pressed'
                    onClick={() => void handleConfirmNavigation()}
                  >
                    确认前往
                  </Button>
                </View>
              </View>
            )}
            <Button
              className='ai-app-navigator__submit'
              aria-label='查找推荐功能'
              disabled={!query.trim() || isLoading}
              hoverClass='ai-app-navigator__submit--pressed'
              onClick={handleSubmit}
            >
              {isLoading ? (
                <>
                  <View className='ai-app-navigator__spinner'>
                    <Icon component={LoaderCircle} size={20} color='#FFFFFF' strokeWidth={2} />
                  </View>
                  <Text>正在匹配</Text>
                </>
              ) : (
                <>
                  <Text>查找推荐</Text>
                  <Icon component={ArrowUp} size={20} color='#FFFFFF' strokeWidth={2} />
                </>
              )}
            </Button>
          </View>
        </View>
      ) : (
        <Button
          className='ai-app-navigator__fab'
          aria-label='打开 AI 应用导航'
          hoverClass='ai-app-navigator__fab--pressed'
          onClick={openPanel}
        >
          <Text className='ai-app-navigator__fab-label'>AI</Text>
        </Button>
      )}
    </View>
  )
}
