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
import { buildMuscleScores, highlightBodySvg } from '@coachlink/core/src/publicTrainingSummary'
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

function highlightSvgCategories(svg: string, selectedParts: string[]) {
  return svgToDataUri(highlightBodySvg(svg, selectedParts).replace(
    /<svg\s/,
    '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
  ))
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

