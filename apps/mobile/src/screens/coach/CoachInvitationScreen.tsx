import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as Clipboard from 'expo-clipboard'
import type { RootStackParamList } from '../../navigation/types'
import { IconFont } from '../../components/IconFont'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import { openExternalUrl } from '../../externalLinks'
import {
  Card,
  EmptyState,
  LoadingState,
  ScreenShell,
  SolidButton,
  safeRequest,
} from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type PosterStatus = 'queued' | 'generating' | 'ready' | 'failed'

type PosterData = {
  status: PosterStatus
  imageUrl: string | null
  updatedAt?: string | null
  lastError?: string | null
}

const EMPTY_POSTER: PosterData = {
  status: 'queued',
  imageUrl: null,
  updatedAt: null,
  lastError: null,
}

export function CoachInvitationScreen() {
  const navigation = useNavigation<Navigation>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [poster, setPoster] = useState<PosterData>(EMPTY_POSTER)
  const [feedback, setFeedback] = useState('')

  const loadPoster = useCallback(async () => {
    const data = await safeRequest<any>(
      '/api/coach/poster/status?posterType=invitation_hd',
      { method: 'GET' },
    )
    const next: PosterData = {
      status: data?.imageUrl ? 'ready' : data?.status || 'queued',
      imageUrl: data?.imageUrl || null,
      updatedAt: data?.updatedAt || null,
      lastError: data?.lastError || null,
    }
    setPoster(next)
    if (next.status === 'ready' || next.status === 'failed') setGenerating(false)
    return next
  }, [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [coachResult, posterResult] = await Promise.allSettled([
        safeRequest<any>('/api/coach/get-coach', { body: { userId: user?.id } }),
        loadPoster(),
      ])
      if (coachResult.status === 'rejected') throw coachResult.reason
      const coachData = coachResult.value || {}
      const code = String(
        coachData?.invitationInfo?.invitationCode || coachData?.coach?.invitation_code || '',
      )
      const url = String(
        coachData?.invitationInfo?.inviteUrl ||
          (code ? `https://coachlink.com/register?invite=${encodeURIComponent(code)}` : ''),
      )
      setInvitationCode(code)
      setInviteUrl(url)
      if (posterResult.status === 'rejected') {
        console.warn('[coach-invitation] poster status load failed', posterResult.reason)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '邀请信息加载失败')
    } finally {
      setLoading(false)
    }
  }, [loadPoster, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!generating && poster.status !== 'queued' && poster.status !== 'generating') return
    const timer = setInterval(() => {
      void loadPoster().catch((pollError) => {
        console.warn('[coach-invitation] poster polling failed', pollError)
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [generating, loadPoster, poster.status])

  const posterUrl = useMemo(() => {
    if (!poster.imageUrl) return ''
    const separator = poster.imageUrl.includes('?') ? '&' : '?'
    return `${poster.imageUrl}${separator}v=${encodeURIComponent(poster.updatedAt || String(Date.now()))}`
  }, [poster.imageUrl, poster.updatedAt])

  async function copy(value: string, label: string) {
    if (!value) return
    try {
      await Clipboard.setStringAsync(value)
      setFeedback(`${label}已复制`)
    } catch {
      setFeedback('复制失败，请稍后重试')
    }
    setTimeout(() => setFeedback(''), 1800)
  }

  async function shareInvitation() {
    if (!inviteUrl) return
    try {
      await Share.share({
        title: 'CoachLink 教练邀请',
        message: `使用我的邀请码 ${invitationCode} 加入 CoachLink：${inviteUrl}`,
        url: inviteUrl,
      })
    } catch {
      setFeedback('分享失败，请稍后重试')
      setTimeout(() => setFeedback(''), 1800)
    }
  }

  async function triggerPoster() {
    try {
      setGenerating(true)
      setPoster((current) => ({ ...current, status: 'generating', lastError: null }))
      await safeRequest('/api/coach/poster/trigger', {
        body: { posterType: 'invitation_hd' },
      })
      await loadPoster()
    } catch (triggerError) {
      setGenerating(false)
      setPoster((current) => ({
        ...current,
        status: 'failed',
        lastError: triggerError instanceof Error ? triggerError.message : '海报生成失败',
      }))
    }
  }

  if (loading) {
    return (
      <ScreenShell title="邀请学员" subtitle="邀请码、链接与高清邀请海报。" onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载邀请信息" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="邀请学员" subtitle="分享专属邀请码、注册链接或高清海报。" onBack={() => navigation.goBack()}>
      {error ? <EmptyState title="加载失败" desc={error} icon="icon-wenhao" /> : null}
      {feedback ? <View style={styles.feedback}><Text style={styles.feedbackText}>{feedback}</Text></View> : null}

      <Card style={styles.codeCard}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}><IconFont name="icon-share" color={colors.brand} size={22} /></View>
          <View style={styles.headerMain}>
            <Text style={styles.cardTitle}>专属邀请码</Text>
            <Text style={styles.cardDescription}>学员注册时填写后会与你建立邀请关联。</Text>
          </View>
        </View>
        <Text style={styles.code}>{invitationCode || '未设置'}</Text>
        <SolidButton label="复制邀请码" variant="secondary" disabled={!invitationCode} onPress={() => void copy(invitationCode, '邀请码')} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>邀请链接</Text>
        <Text style={styles.link} selectable>{inviteUrl || '当前账号尚未生成邀请链接'}</Text>
        <View style={styles.buttonRow}>
          <View style={styles.buttonCell}><SolidButton label="复制链接" variant="secondary" disabled={!inviteUrl} onPress={() => void copy(inviteUrl, '链接')} /></View>
          <View style={styles.buttonCell}><SolidButton label="系统分享" disabled={!inviteUrl} onPress={() => void shareInvitation()} /></View>
        </View>
      </Card>

      <Card>
        <View style={styles.posterHeader}>
          <View style={styles.headerMain}>
            <Text style={styles.cardTitle}>邀请海报</Text>
            <Text style={styles.cardDescription}>
              {poster.imageUrl
                ? '高清海报已就绪，点击图片可在浏览器查看原图。'
                : poster.status === 'failed'
                  ? '上次生成失败，可以重新生成。'
                  : '海报正在后台生成，页面会自动更新状态。'}
            </Text>
          </View>
          <View style={[styles.statusBadge, poster.imageUrl && styles.statusReady]}>
            <Text style={[styles.statusText, poster.imageUrl && styles.statusTextReady]}>
              {poster.imageUrl ? '已就绪' : poster.status === 'failed' ? '失败' : '生成中'}
            </Text>
          </View>
        </View>

        {posterUrl ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel="查看邀请海报高清原图" onPress={() => void openExternalUrl(posterUrl, { errorTitle: '海报打开失败' })} style={styles.posterWrap}>
            <Image source={{ uri: posterUrl }} resizeMode="contain" style={styles.posterImage} />
            <Text style={styles.posterHint}>点击查看高清原图</Text>
          </Pressable>
        ) : (
          <View style={styles.posterEmpty}>
            <IconFont name="icon-picture" color={colors.textMuted} size={34} />
            <Text style={styles.posterEmptyText}>{generating ? '正在生成高清海报…' : '暂无可用海报'}</Text>
          </View>
        )}

        {poster.lastError ? <Text style={styles.errorText}>{poster.lastError}</Text> : null}
        <SolidButton
          label={generating ? '生成中…' : poster.imageUrl ? '更新海报' : '生成海报'}
          variant="secondary"
          disabled={generating}
          onPress={() => void triggerPoster()}
        />
      </Card>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  feedback: { padding: spacing.sm, borderRadius: radius.lg, backgroundColor: '#E9F8F3' },
  feedbackText: { color: '#087A63', fontSize: 13, fontWeight: '800' },
  codeCard: { gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.brandSoft },
  headerMain: { flex: 1, gap: 4 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  cardDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  code: { paddingVertical: spacing.sm, color: colors.brand, fontSize: 32, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  link: { padding: spacing.sm, borderRadius: radius.lg, color: colors.textSecondary, backgroundColor: colors.background, fontSize: 13, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  buttonCell: { flex: 1 },
  posterHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: '#FFF1EE' },
  statusReady: { backgroundColor: '#E9F8F3' },
  statusText: { color: colors.brand, fontSize: 11, fontWeight: '900' },
  statusTextReady: { color: '#087A63' },
  posterWrap: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  posterImage: { width: '100%', height: 440 },
  posterHint: { padding: spacing.sm, color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  posterEmpty: { minHeight: 184, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  posterEmptyText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
})
