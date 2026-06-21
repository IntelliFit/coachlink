import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'GeneratePlanWaiting'>
type PollStatus = 'idle' | 'polling' | 'success' | 'error' | 'async_pending'

function domainLabel(domain?: string) {
  if (domain === 'weighted_pullup') return '负重引体'
  if (domain === 'weighted_dips') return '负重臂屈伸'
  if (domain === 'combo') return '引体+臂屈伸组合'
  return ''
}

export function GeneratePlanWaitingScreen({ navigation, route }: Props) {
  const coachId = route.params?.coachId || ''
  const domain = route.params?.domain || ''
  const taskId = route.params?.taskId || ''
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState('正在为您制定训练计划...')
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStartedRef = useRef(false)

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const startFakeProgress = useCallback(() => {
    clearProgressTimer()
    setProgress(12)
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => (prev >= 85 ? 85 : prev + 8))
    }, 450)
  }, [clearProgressTimer])

  const goPlans = useCallback(() => {
    navigation.reset({ index: 1, routes: [{ name: 'MainTabs' }, { name: 'PlanHistory' }] })
  }, [navigation])

  const handleQuickGenerate = useCallback(async () => {
    if (!coachId) {
      Alert.alert('缺少教练信息', '请返回重新选择教练。')
      return
    }
    clearProgressTimer()
    setError('')
    setLoading(true)
    setPollStatus('polling')
    setTip('正在为您快速生成计划...')
    setProgress(0)
    startFakeProgress()
    try {
      const res = await apiClient.request('/api/user/generate-quick-plan', {
        method: 'POST',
        body: { coachId, domain },
        timeoutMs: 30000,
      })
      const data = (res as any).data?.data || (res as any).data || {}
      if ((res as any).data?.success === false) throw new Error((res as any).data?.message || '生成失败，请重试')
      if (data.planId) {
        setPollStatus('success')
        setTip('计划生成成功！')
        setProgress(100)
        setTimeout(goPlans, 800)
      } else if (data.taskId) {
        setPollStatus('async_pending')
        setTip('生成请求已提交为异步任务。请稍后在“全部计划”查看结果，或重新提交。')
        setProgress(100)
      } else {
        setPollStatus('success')
        setTip('请求已提交')
        setProgress(100)
        setTimeout(goPlans, 1000)
      }
    } catch (e: any) {
      setPollStatus('error')
      setError(e?.message || '生成失败，请重试')
      setTip(e?.message || '生成失败')
    } finally {
      clearProgressTimer()
      setLoading(false)
    }
  }, [coachId, domain, clearProgressTimer, goPlans, startFakeProgress])

  useEffect(() => {
    if (!coachId) {
      setPollStatus('error')
      setError('缺少教练信息，请返回重新选择。')
      return
    }
    if (autoStartedRef.current) return
    autoStartedRef.current = true
    if (taskId) {
      setTip('检测到历史任务请求。当前版本暂不支持任务轮询，建议稍后在“全部计划”查看，或点击“重新生成”。')
      setPollStatus('async_pending')
      setProgress(100)
      return
    }
    void handleQuickGenerate()
  }, [coachId, handleQuickGenerate, taskId])

  useEffect(() => clearProgressTimer, [clearProgressTimer])

  const title = pollStatus === 'success' ? '计划生成成功' : pollStatus === 'error' ? '生成失败' : pollStatus === 'async_pending' ? '生成请求已提交' : '计划创建请求已提交'

  return (
    <Page>
      <View style={styles.card}>
        <View style={[styles.iconWrap, pollStatus === 'error' && styles.iconError, pollStatus === 'success' && styles.iconSuccess]}>
          {pollStatus === 'polling' || pollStatus === 'idle' ? <ActivityIndicator color={colors.brand} /> : <IconFont name={pollStatus === 'success' ? 'icon-jhk' : 'icon-time'} color={pollStatus === 'error' ? '#DC2626' : colors.brand} size={30} />}
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{domain ? `您已选择「${domainLabel(domain)}」训练域。` : ''}{error || tip}</Text>

        {pollStatus === 'polling' ? (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {pollStatus === 'success' ? <Pressable onPress={goPlans} style={styles.primaryButton}><Text style={styles.primaryButtonText}>查看全部计划</Text></Pressable> : null}
          {pollStatus === 'error' ? (
            <>
              <Pressable onPress={handleQuickGenerate} style={styles.primaryButton}><Text style={styles.primaryButtonText}>重新生成</Text></Pressable>
              <Pressable onPress={goPlans} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>查看全部计划</Text></Pressable>
            </>
          ) : null}
          {pollStatus === 'async_pending' ? (
            <>
              <Pressable onPress={goPlans} style={styles.primaryButton}><Text style={styles.primaryButtonText}>查看全部计划</Text></Pressable>
              <Pressable onPress={handleQuickGenerate} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>重新生成</Text></Pressable>
            </>
          ) : null}
          {pollStatus === 'idle' || pollStatus === 'polling' ? (
            <>
              <Pressable onPress={goPlans} style={styles.primaryButton}><Text style={styles.primaryButtonText}>前往全部计划</Text></Pressable>
              <Pressable disabled={loading} onPress={handleQuickGenerate} style={[styles.secondaryButton, loading && styles.disabledButton]}><Text style={styles.secondaryButtonText}>{loading ? '生成中...' : '智能快速生成'}</Text></Pressable>
            </>
          ) : null}
        </View>
      </View>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>返回</Text></Pressable>
    </Page>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.md, borderRadius: radius.xl, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  iconError: { backgroundColor: '#FEE2E2' },
  iconSuccess: { backgroundColor: colors.brandSoft },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  desc: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  progressSection: { alignSelf: 'stretch', gap: spacing.xs },
  progressBar: { height: 10, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  progressFill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.brand },
  progressText: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  actions: { alignSelf: 'stretch', gap: spacing.sm },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  disabledButton: { opacity: 0.52 },
  backButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.textMuted, fontSize: 14, fontWeight: '800' },
})
