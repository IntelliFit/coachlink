import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { WECHAT_FREE_LIMITS } from '@coachlink/core'
import { authService } from '@/services/authService'
import { request } from '@/utils/request'
import { useTheme } from '@/hooks/useTheme'
import '../FreeReleaseInfo/index.scss'

interface Quota { ai_import_balance: number; storage_used_mb: number; storage_total_mb: number; access_mode?: string }

export default function FreeMembershipPage() {
  const { effectiveTheme } = useTheme()
  const [quota, setQuota] = useState<Quota | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: '功能与用量' })
    if (!authService.getCurrentUser()?.id) {
      setQuota(null)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    request<Quota>({ url: '/api/membership/get-quota', method: 'POST', data: {}, showErrorToast: false }).then(q => {
      if (q.success && q.data?.access_mode === 'wechat-free-v1') setQuota(q.data)
      else { setQuota(null); setError('个人用量暂时无法加载，请稍后重试') }
    }).catch(() => {
      setQuota(null)
      setError('个人用量暂时无法加载，请稍后重试')
    }).then(() => setLoading(false))
  })
  const signedIn = !!authService.getCurrentUser()?.id
  return (
    <View className={`free-release-page theme-${effectiveTheme}`}>
      <View className='free-release-card'>
        <Text className='free-release-title'>功能与用量</Text>
        <Text className='free-release-copy'>训练记录和计划管理可直接使用。</Text>
        <Text className='free-release-copy'>智能计划导入：每月 {WECHAT_FREE_LIMITS.aiImportsMonthly} 次{quota ? `，本月剩余 ${quota.ai_import_balance} 次` : ''}。</Text>
        <Text className='free-release-copy'>训练视频空间：{quota ? `${Number(quota.storage_used_mb || 0).toFixed(1)} / ${quota.storage_total_mb}` : WECHAT_FREE_LIMITS.storageMb} MB。</Text>
        <Text className='free-release-copy'>功率分析基础用量：每日 {WECHAT_FREE_LIMITS.powerDaily} 次，支持原画质，单段视频 {WECHAT_FREE_LIMITS.powerVideoMb} MB / {WECHAT_FREE_LIMITS.powerDurationSeconds} 秒。</Text>
        {loading && <Text className='free-release-copy'>正在加载个人用量…</Text>}
        {error && <Text className='free-release-copy'>{error}</Text>}
        <View className='free-release-button' onClick={() => signedIn
          ? Taro.reLaunch({ url: '/pages/index/index' })
          : Taro.navigateTo({ url: '/auth/login' })}>
          <Text>{signedIn ? '开始训练' : '登录后使用'}</Text>
        </View>
      </View>
    </View>
  )
}
