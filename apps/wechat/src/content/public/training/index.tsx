import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Image, Button } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { request } from '@/utils/request'
import {
  buildPublicTrainingSharePath,
  createSharePayload,
  createTimelinePayload,
  getPublicTrainingShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import { svgToDataUri } from '@/utils/svgToDataUri'
import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

interface ActionExecutionSummary {
  actionName: string
  setsCount: number
  volume: number
}

interface PublicTrainingData {
  executionId: string
  planName: string
  completedAt: string
  totalVolume: number
  totalSets: number
  durationMinutes: number
  actionExecutions: ActionExecutionSummary[]
  user: {
    nickname: string
    avatarUrl: string
  }
}

function formatDateTime(input: string) {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return input
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const MUSCLE_FILL_ORIGIN_STYLE = 'fill:#222222'
const MUSCLE_FILL_HIGHLIGHT_STYLE = 'fill:#CF6D4E'

const MUSCLE_INFERENCE_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: '胸部', keywords: ['胸', '卧推', '飞鸟', '夹胸', '俯卧撑', '双杠', '臂屈伸'] },
  { label: '背部', keywords: ['背', '引体', '划船', '下拉', '硬拉', '高位下拉'] },
  { label: '肩部', keywords: ['肩', '推举', '侧平举', '三角肌', '面拉'] },
  { label: '手臂', keywords: ['手臂', '二头', '三头', '肱二头', '肱三头', '弯举', '臂屈伸'] },
  { label: '核心', keywords: ['核心', '腹', '卷腹', '平板', '腰腹', '悬垂举腿'] },
  { label: '腿部', keywords: ['腿', '深蹲', '腿举', '弓步', '股四头', '腘绳', '蹲'] },
  { label: '臀部', keywords: ['臀', '臀桥', '髋', '硬拉'] }
]

function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  const singleLineRegex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = singleLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  const multiLineRegex = /<g\s*\n?\s*data-name="([^"]+)"\s*\n?\s*category="([^"]+)"/g
  while ((match = multiLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  return map
}

function highlightSvgCategories(svg: string, selectedParts: string[]) {
  const categoryMap = parseSvgCategoryMap(svg)
  const dataNamesToHighlight = new Set<string>()
  selectedParts.forEach((part) => {
    Object.entries(categoryMap).forEach(([dataName, category]) => {
      if (category === part) dataNamesToHighlight.add(dataName)
    })
  })

  let result = svg
    .replace(/fill:#fff/gi, MUSCLE_FILL_ORIGIN_STYLE)
    .replace(/fill="#fff"/gi, 'fill="#222222"')

  dataNamesToHighlight.forEach((dataName) => {
    const regex = new RegExp(`(<g[^>]*data-name="${dataName}"[^>]*>)([\\s\\S]*?)(</g>)`, 'g')
    result = result.replace(regex, (_match, open, content, close) => {
      const highlighted = content.replace(
        new RegExp(MUSCLE_FILL_ORIGIN_STYLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        MUSCLE_FILL_HIGHLIGHT_STYLE
      )
      return open + highlighted + close
    })
  })

  return svgToDataUri(result.replace(
    /<svg\s/,
    '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
  ))
}

function inferMusclesForAction(action: ActionExecutionSummary): string[] {
  const sourceText = String(action?.actionName || '').toLowerCase()
  return MUSCLE_INFERENCE_RULES
    .filter((rule) => rule.keywords.some((keyword) => sourceText.includes(keyword.toLowerCase())))
    .map((rule) => rule.label)
}

function buildMuscleScores(actions: ActionExecutionSummary[]) {
  const scores = new Map<string, number>()
  actions.forEach((action) => {
    const muscles = inferMusclesForAction(action)
    const score = Math.max(1, Number(action.setsCount || 0)) + Math.max(0, Math.round(Number(action.volume || 0) / 1000))
    muscles.forEach((muscle) => scores.set(muscle, (scores.get(muscle) || 0) + score))
  })

  return Array.from(scores.entries())
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score)
}

/**
 * 公开训练详情页
 * 路由：/content/public/training?token=xxx
 * 无需登录，通过公开接口展示一次训练的概要数据
 */
export default function PublicTrainingPage() {
  const { effectiveTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PublicTrainingData | null>(null)
  const params = Taro.getCurrentInstance().router?.params || {}
  const token = String(params.token || '')
  const sharePath = useMemo(
    () => buildPublicTrainingSharePath(token),
    [token]
  )
  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: getPublicTrainingShareTitle(data?.user?.nickname, data?.planName),
        path: sharePath
      }),
    [data?.planName, data?.user?.nickname, sharePath]
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('缺少分享 token')
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await request<PublicTrainingData>({
          url: `/api/public/training?token=${encodeURIComponent(token)}`,
          method: 'GET',
          showErrorToast: false
        })

        if (res.success && res.data) {
          setData(res.data)
        } else {
          setError(res.message || '获取训练信息失败')
        }
      } catch (e: any) {
        setError(e?.message || '网络请求失败')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <View className={`public-training-page theme-${effectiveTheme}`}>
        <View className="loading-wrap">
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  if (error || !data) {
    return (
      <View className={`public-training-page theme-${effectiveTheme}`}>
        <View className="error-wrap">
          <Text className="error-title">{error || '内容不可见'}</Text>
          <View className="error-btn" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
            <Text>回到首页</Text>
          </View>
        </View>
      </View>
    )
  }

  const dateStr = formatDateTime(data.completedAt)
  const totalVolumeTons = Math.round((data.totalVolume / 1000) * 10) / 10
  const muscleScores = buildMuscleScores(data.actionExecutions || [])
  const highlightedMuscles = muscleScores.map((item) => item.label)
  const heatmapFrontSvg = highlightSvgCategories(maleFrontSvgRaw, highlightedMuscles)
  const heatmapBackSvg = highlightSvgCategories(maleBackSvgRaw, highlightedMuscles)
  const maxMuscleScore = Math.max(1, ...muscleScores.map((item) => item.score))

  return (
    <View className={`public-training-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className="scroll">
        <View className="scroll-inner">
          <View className="result-card">
            <View className="result-header">
              <View className="avatar-wrap">
                {data.user.avatarUrl ? (
                  <Image className="avatar" src={data.user.avatarUrl} mode="aspectFill" />
                ) : (
                  <View className="avatar placeholder">
                    <Text className="avatar-initial">
                      {data.user.nickname ? data.user.nickname.charAt(0) : '练'}
                    </Text>
                  </View>
                )}
              </View>
              <View className="result-title-wrap">
                <Text className="result-eyebrow">TRAINING COMPLETE</Text>
                <Text className="result-title">{data.user.nickname} 完成训练</Text>
                <Text className="result-meta">{dateStr} · {data.planName}</Text>
              </View>
            </View>

            <View className="heatmap-row">
              <View className="body-map">
                <Image className="body-image" src={heatmapFrontSvg} mode="aspectFit" />
                <Text className="body-caption">正面</Text>
              </View>
              <View className="body-map">
                <Image className="body-image" src={heatmapBackSvg} mode="aspectFit" />
                <Text className="body-caption">背面</Text>
              </View>
            </View>

            <View className="stats-row">
              <View className="stat-card">
                <Text className="stat-value">{totalVolumeTons}</Text>
                <Text className="stat-label">总容量 t</Text>
              </View>
              <View className="stat-card">
                <Text className="stat-value">{data.totalSets}</Text>
                <Text className="stat-label">完成组数</Text>
              </View>
              <View className="stat-card">
                <Text className="stat-value">{data.durationMinutes || '-'}</Text>
                <Text className="stat-label">分钟</Text>
              </View>
            </View>

            <View className="muscle-list">
              {(muscleScores.length > 0 ? muscleScores : [{ label: '全身', score: 1 }]).slice(0, 5).map((item) => (
                <View key={item.label} className="muscle-row">
                  <Text className="muscle-name">{item.label}</Text>
                  <View className="muscle-track">
                    <View className="muscle-fill" style={{ width: `${Math.max(12, Math.round((item.score / maxMuscleScore) * 100))}%` }} />
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="section">
            <Text className="section-title">训练明细</Text>
            {data.actionExecutions && data.actionExecutions.length > 0 ? (
              <View className="actions-list">
                {data.actionExecutions.map((action, idx) => (
                  <View key={idx} className="action-item">
                    <View className="action-left">
                      <View className="action-index">
                        <Text>{idx + 1}</Text>
                      </View>
                      <Text className="action-name">{action.actionName}</Text>
                    </View>
                    <View className="action-right">
                      <View className="badge primary">
                        <Text>{action.setsCount} 组</Text>
                      </View>
                      {action.volume > 0 && (
                        <Text className="action-volume">{action.volume} kg</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="empty-text">暂无详细动作记录</Text>
            )}
          </View>

          <View className="cta-card">
            <Text className="cta-title">想要同款训练计划？</Text>
            <Text className="cta-text">
              在 CoachLink，你可以跟随专业教练，获得完整的训练计划与记录工具。
            </Text>
            <View className="cta-actions">
              <View
                className="cta-btn primary"
                onClick={() => Taro.navigateTo({ url: '/auth/register' })}
              >
                <Text>立即加入</Text>
              </View>
              <View
                className="cta-btn secondary"
                onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}
              >
                <Text>查看今日训练</Text>
              </View>
            </View>
          </View>

          <View className="share-section">
            <Button
              className="share-btn"
              openType="share"
            >
              <Text>分享给朋友</Text>
            </Button>
            <Text className="share-hint">点击右上角分享给朋友或朋友圈</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

