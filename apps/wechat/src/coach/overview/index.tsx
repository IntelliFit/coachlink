import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import BottomNav from '@/components/BottomNav'
import {
  TrendingUp,
  CheckCircle2,
  CircleDashed,
  FileText,
  Library,
  Layout,
  Activity,
  ChevronRight,
  Wallet,
  UserPlus,
  Shield,
  Bot
} from 'lucide-react'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'
interface OverviewData {
  totalStudentCount: number
  pendingReviewCount: number
  averageRating: number
  monthlyRevenue: number
  contentCount: number
  actionCount: number
  planTemplateCount: number
  questionReady: boolean
  pricingReady: boolean
  receivingAccountReady: boolean
  huifuOpenStatus: string | null
  huifuOpenMsg: string | null
}

function toSafeNumber(value: any, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toSafeBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

function formatMoney(value?: number | null): string {
  return Number(value ?? 0).toFixed(2)
}

function normalizeOverviewData(payload: any): OverviewData | null {
  if (!payload || typeof payload !== 'object') return null

  const raw = (payload as any).overview || (payload as any).data || payload
  if (!raw || typeof raw !== 'object') return null

  return {
    totalStudentCount: toSafeNumber(raw.totalStudentCount ?? raw.total_student_count),
    pendingReviewCount: toSafeNumber(raw.pendingReviewCount ?? raw.pending_review_count),
    averageRating: toSafeNumber(raw.averageRating ?? raw.average_rating),
    monthlyRevenue: toSafeNumber(raw.monthlyRevenue ?? raw.monthly_revenue),
    contentCount: toSafeNumber(raw.contentCount ?? raw.content_count),
    actionCount: toSafeNumber(raw.actionCount ?? raw.action_count),
    planTemplateCount: toSafeNumber(raw.planTemplateCount ?? raw.plan_template_count),
    questionReady: toSafeBoolean(raw.questionReady ?? raw.question_ready),
    pricingReady: toSafeBoolean(raw.pricingReady ?? raw.pricing_ready),
    receivingAccountReady: toSafeBoolean(raw.receivingAccountReady ?? raw.receiving_account_ready),
    huifuOpenStatus: raw.huifuOpenStatus ?? raw.huifu_open_status ?? null,
    huifuOpenMsg: raw.huifuOpenMsg ?? raw.huifu_open_msg ?? null
  }
}

function CoachOverview() {
  const { effectiveTheme } = useTheme()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let token: string | null = null
    try {
      token = Taro.getStorageSync('token')
    } catch (e) {
      console.error('[coach/overview] get token:', e)
    }
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/coach/overview')
      }).catch(() => {
        Taro.reLaunch({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/overview') })
      })
      return
    }
    loadOverview()
  }, [])

  async function loadOverview() {
    try {
      setLoading(true)
      setError(null)
      const res = await coachService.getOverviewData()
      const normalized = normalizeOverviewData(res)
      if (normalized) {
        setData(normalized)
      } else {
        setError('加载失败，请检查网络或稍后重试')
      }
    } catch (e) {
      console.error('[coach/overview] load:', e)
      setError('网络异常，请重试')
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function navTo(url: string) {
    if (!url) {
      Taro.showToast({ title: '页面地址无效', icon: 'none' })
      return
    }
    Taro.navigateTo({ url }).catch((err) => {
      console.error('[coach/overview] 导航失败:', err)
      Taro.showToast({ title: '页面暂不可用', icon: 'none' })
    })
  }

  if (loading) {
    return (
      <View className={`coach-overview-page theme-${effectiveTheme}`}>
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  if (error) {
    return (
      <View className={`coach-overview-page theme-${effectiveTheme}`}>
        <View className="error-wrap">{error}</View>
        <BottomNav />
      </View>
    )
  }

  if (!data) {
    return (
      <View className={`coach-overview-page theme-${effectiveTheme}`}>
        <View className="loading-wrap">暂无数据</View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className={`coach-overview-page theme-${effectiveTheme}`}>
    <ScrollView scrollY className="coach-overview-scroll">
      {/* 业务概览 */}
      <View className="section">
        <Text className="section-title">业务概览</Text>
        <View className="core-grid">
          <View className="stat-tile" onClick={() => navTo('/coach/students')}>
            <View className="tile-header">
              <View className="tile-icon-wrap blue">
                <View className="people-icon"><View className="people-head people-head-main" /><View className="people-head people-head-side" /><View className="people-body people-body-main" /><View className="people-body people-body-side" /></View>
              </View>
            </View>
            <Text className="tile-label">总学员数</Text>
            <Text className="tile-value">{data.totalStudentCount}</Text>
          </View>
          <View className="stat-tile" onClick={() => navTo('/coach/videos')}>
            <View className="tile-header">
              <View className="tile-icon-wrap amber">
                <View className="video-icon"><View className="video-play" /><View className="video-check"><View className="video-check-dot" /></View></View>
              </View>
            </View>
            <Text className="tile-label">待点评视频</Text>
            <Text className="tile-value">{data.pendingReviewCount}</Text>
          </View>
          <View className="stat-tile">
            <View className="tile-header">
              <View className="tile-icon-wrap yellow">
                <View className="rating-star"><View className="rating-star-core" /></View>
              </View>
            </View>
            <Text className="tile-label">平均评分</Text>
            <Text className="tile-value">{toSafeNumber(data.averageRating).toFixed(1)}</Text>
          </View>
          {/* <View className="stat-tile" onClick={() => navTo('/coach/revenue')}>
            <View className="tile-header">
              <View className="tile-icon-wrap purple">
                <Icon component={TrendingUp} size={18} color="#7c3aed" />
              </View>
            </View>
            <Text className="tile-label">本月收入</Text>
            <Text className="tile-value">¥{formatMoney(data.monthlyRevenue)}</Text>
          </View> */}
          <View className="stat-tile" onClick={() => navTo('/coach/wallet')}>
            <View className="tile-header">
              <View className="tile-icon-wrap green">
                <View className="wallet-icon"><View className="wallet-clasp"><View className="wallet-dot" /></View></View>
              </View>
            </View>
            <Text className="tile-label">我的钱包</Text>
            <Text className="tile-value">查看</Text>
          </View>
        </View>
      </View>

      {/* 教学资产配置 */}
      <View className="section">
        <Text className="section-title">教学资产配置</Text>
        <View className="config-list">
          <View className="config-row" onClick={() => navTo('/coach/wallet/merchant')}>
            <View className={`config-icon-wrap ${data.receivingAccountReady ? 'emerald' : 'orange'}`}>
              <Icon
                component={data.receivingAccountReady ? CheckCircle2 : Wallet}
                size={20}
                color={data.receivingAccountReady ? '#059669' : '#ea580c'}
              />
            </View>
            <View className="config-body">
              <Text className="config-title">收款账户</Text>
              <Text className="config-desc">用于平台分账和银行卡提现</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">{data.receivingAccountReady ? '已开通' : '待绑定'}</Text>
              {data.receivingAccountReady && <Text className="config-badge">已就绪</Text>}
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/pricing')}>
            <View className={`config-icon-wrap ${data.pricingReady ? 'emerald' : 'rose'}`}>
              <Icon
                component={data.pricingReady ? CheckCircle2 : CircleDashed}
                size={20}
                color={data.pricingReady ? '#059669' : '#e11d48'}
              />
            </View>
            <View className="config-body">
              <Text className="config-title">订阅定价</Text>
              <Text className="config-desc">设置您的会员方案</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">{data.pricingReady ? '已激活' : '待配置'}</Text>
              {data.pricingReady && <Text className="config-badge">已就绪</Text>}
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/automation')}>
            <View className="config-icon-wrap primary">
              <Icon component={Bot} size={20} color="#CF6D4E" />
            </View>
            <View className="config-body">
              <Text className="config-title">自动化设置</Text>
              <Text className="config-desc">计划发放、反馈调整、下一阶段</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">配置</Text>
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/questionnaire')}>
            <View className={`config-icon-wrap ${data.questionReady ? 'emerald' : 'orange'}`}>
              <Icon component={FileText} size={20} color={data.questionReady ? '#059669' : '#ea580c'} />
            </View>
            <View className="config-body">
              <Text className="config-title">学员问卷</Text>
              <Text className="config-desc">收集学员基础信息</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">{data.questionReady ? '已开启' : '待设置'}</Text>
              {data.questionReady && <Text className="config-badge">已就绪</Text>}
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/content')}>
            <View className="config-icon-wrap primary">
              <Icon component={Library} size={20} color="#CF6D4E" />
            </View>
            <View className="config-body">
              <Text className="config-title">内容库</Text>
              <Text className="config-desc">已发布的文章与视频</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">{data.contentCount}</Text>
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/plan-lib')}>
            <View className="config-icon-wrap indigo">
              <Icon component={Layout} size={20} color="#CF6D4E" />
            </View>
            <View className="config-body">
              <Text className="config-title">计划库</Text>
              <Text className="config-desc">标准化训练方案</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">{data.planTemplateCount}</Text>
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/action-lib')}>
            <View className="config-icon-wrap slate">
              <Icon component={Activity} size={20} color="#666666" />
            </View>
            <View className="config-body">
              <Text className="config-title">动作库</Text>
              <Text className="config-desc">演示资源总数</Text>
            </View>
            <View className="config-right">
              <Text className="config-value">{data.actionCount}</Text>
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/wallet')}>
            <View className="config-icon-wrap green">
              <Icon component={Wallet} size={20} color="#CF6D4E" />
            </View>
            <View className="config-body">
              <Text className="config-title">我的钱包</Text>
              <Text className="config-desc">余额、流水、提现</Text>
            </View>
            <View className="config-right">
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
        </View>
      </View>

      {/* 设置 */}
      <View className="section">
        <Text className="section-title">设置</Text>
        <View className="config-list">
          <View className="config-row" onClick={() => navTo('/coach/settings/invitation')}>
            <View className="config-icon-wrap blue">
              <Icon component={UserPlus} size={20} color="#CF6D4E" />
            </View>
            <View className="config-body">
              <Text className="config-title">邀请学员</Text>
              <Text className="config-desc">分享邀请码和链接</Text>
            </View>
            <View className="config-right">
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/wallet/merchant')}>
            <View className="config-icon-wrap emerald">
              <Icon component={Wallet} size={20} color="#29C3A3" />
            </View>
            <View className="config-body">
              <Text className="config-title">收款账户</Text>
              <Text className="config-desc">开通汇付账户并绑定银行卡</Text>
            </View>
            <View className="config-right">
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
          <View className="config-row" onClick={() => navTo('/coach/settings/security')}>
            <View className="config-icon-wrap slate">
              <Icon component={Shield} size={20} color="#666666" />
            </View>
            <View className="config-body">
              <Text className="config-title">安全设置</Text>
              <Text className="config-desc">账号安全与隐私设置</Text>
            </View>
            <View className="config-right">
              <Icon component={ChevronRight} size={16} color="#d1d5db" />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
    <BottomNav />
    </View>
  )
}

export default CoachOverview
