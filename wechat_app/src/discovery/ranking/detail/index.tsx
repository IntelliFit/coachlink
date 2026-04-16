import React, { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Star } from '@nutui/icons-react-taro'
import { rankingService } from '@/services/rankingService'
import type { LeaderboardFormInput } from '@/types/leaderboard'
import LeaderboardHeader from './components/LeaderboardHeader'
import ActivityInfo from './components/ActivityInfo'
import ActivityNotice from './components/ActivityNotice'
import RankingsTable from './components/RankingsTable'
import SubmissionDialog from './components/SubmissionDialog'
import './index.scss'

interface Leaderboard {
  id: string
  title: string
  description: string | null
  start_at: string | null
  end_at: string | null
  rank_by_field: string
  sort_order: string | null
  type: string | null
  rules: { detail: string; status: string }[]
  form_schema: LeaderboardFormInput[]
  remarks: string | null
  created_at: string | null
  creator_id: string | null
  initiator: string | null
  needReview: boolean
}

function RankingDetail() {
  const [templateId, setTemplateId] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [entries, setEntries] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)

  const loadData = useCallback(async () => {
    if (!templateId) return
    try {
      setLoading(true)
      const [lbRes, entriesRes] = await Promise.all([
        rankingService.getLeaderboard({ id: templateId }),
        rankingService.listEntries({
          template_id: templateId,
          status: 'approved',
          limit: 100,
          sort_by: 'score'
        })
      ])
      if (lbRes?.leaderboard) setLeaderboard(lbRes.leaderboard as Leaderboard)
      else setLeaderboard(null)
      setEntries(entriesRes?.entries ?? [])
      setTotal(entriesRes?.total ?? 0)
    } catch (e) {
      console.error('[ranking-detail] load:', e)
      setLeaderboard(null)
      setEntries([])
      setTotal(0)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [templateId])

  useEffect(() => {
    let token: string | null = null
    try {
      token = Taro.getStorageSync('token')
    } catch (e) {
      console.error('[ranking-detail] get token:', e)
    }
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/discovery/ranking/detail?id=' + (Taro.getCurrentInstance().router?.params?.id || ''))
      }).catch((err) => {
        console.error('[ranking-detail] redirectTo 失败:', err);
        Taro.reLaunch({ url: '/auth/login?returnTo=' + encodeURIComponent('/discovery/ranking/detail?id=' + (Taro.getCurrentInstance().router?.params?.id || '')) });
      })
      return
    }

    const inst = Taro.getCurrentInstance()
    const id = (inst?.router?.params as any)?.id
    if (id) {
      setTemplateId(id)
    } else {
      setLoading(false)
      Taro.showToast({ title: '缺少排行榜 ID', icon: 'none' })
    }
  }, [])

  useEffect(() => {
    if (templateId) loadData()
  }, [templateId, loadData])

  const handleBack = () => {
    Taro.navigateBack()
  }

  if (loading && !leaderboard) {
    return (
      <View className="ranking-detail-page">
        <View className="skeleton-detail section" style={{ margin: 16 }}>
          <View className="skeleton-block title" />
          <View className="skeleton-block desc" />
          <View className="skeleton-block desc" />
          <View className="skeleton-meta">
            <View className="skeleton-block" />
            <View className="skeleton-block" />
          </View>
        </View>
      </View>
    )
  }

  if (!leaderboard) {
    return (
      <View className="ranking-detail-page">
        <View className="empty-detail">
          <View className="empty-icon"><Star size={40} /></View>
          <Text className="empty-text">排行榜不存在</Text>
          <View style={{ marginTop: 16 }} onClick={handleBack}>
            <Text style={{ fontSize: 14, fontWeight: 700, color: '#f97316' }}>返回</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className="ranking-detail-page">
      <LeaderboardHeader
        title={leaderboard.title}
        description="月度排行榜挑战赛"
        startAt={leaderboard.start_at}
        endAt={leaderboard.end_at}
        recordCount={total}
        ownerName={leaderboard.initiator || '教链'}
        needReview={leaderboard.needReview}
        onJoinClick={() => setShowDialog(true)}
      />

      <ActivityInfo description={leaderboard.description} rules={leaderboard.rules || []} />

      <RankingsTable
        entries={entries}
        formSchema={leaderboard.form_schema || []}
        rankByField={leaderboard.rank_by_field}
      />

      <ActivityNotice notice={leaderboard.remarks} />

      <SubmissionDialog
        visible={showDialog}
        onHide={() => setShowDialog(false)}
        onSuccess={() => {
          setShowDialog(false)
          loadData()
        }}
        templateId={templateId}
        formSchema={leaderboard.form_schema || []}
        rankByField={leaderboard.rank_by_field}
        needReview={leaderboard.needReview}
      />
    </View>
  )
}

export default RankingDetail
