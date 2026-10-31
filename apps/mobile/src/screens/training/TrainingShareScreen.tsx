import { useEffect, useMemo, useState } from 'react'
import { Alert, Share, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { SvgXml } from 'react-native-svg'
import { buildMuscleScores, highlightBodySvg } from '@coachlink/core/src/publicTrainingSummary'
import { apiClient } from '../../api'
import maleBackSvg from '../../assets/body-map/maleBackSvg'
import maleFrontSvg from '../../assets/body-map/maleFrontSvg'
import { API_BASE_URL } from '../../config'
import type { RootStackParamList } from '../../navigation/types'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, InlineAvatar, LoadingState, ScreenShell, SolidButton, errorMessage } from '../me/MeShared'
import { buildTrainingShareText, formatShareDateTime, mergeTrainingShare, stripSvgProlog, trainingShareTitle, volumeInTons, type TrainingShareData } from './trainingShareModel'

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingShare'>

/** 训练分享页，内容对应小程序公开训练页 content/public/training；分享内容带网页版链接。 */
export function TrainingShareScreen({ navigation, route }: Props) {
  const executionId = route.params?.executionId || ''
  const [data, setData] = useState<TrainingShareData | null>(null)
  const [loading, setLoading] = useState(Boolean(executionId))
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!executionId) return
    let alive = true
    setLoading(true)
    setError('')
    async function load() {
      try {
        const shareInfo = await apiClient.request<any>('/api/execution/share-info', { method: 'POST', body: { id: executionId }, timeoutMs: 12000 })
        const publicTraining = shareInfo?.shareToken
          ? await apiClient.request<any>(`/api/public/training?token=${encodeURIComponent(shareInfo.shareToken)}`, { timeoutMs: 12000 }).catch(() => null)
          : null
        if (alive) setData(mergeTrainingShare(shareInfo, publicTraining))
      } catch (loadError) {
        if (alive) setError(errorMessage(loadError, '加载分享数据失败，请稍后重试'))
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [executionId, reloadKey])

  const muscleScores = useMemo(() => buildMuscleScores(data?.actions || []), [data?.actions])
  const bodyMaps = useMemo(() => {
    const labels = muscleScores.map((item) => item.label)
    return { front: stripSvgProlog(highlightBodySvg(maleFrontSvg, labels)), back: stripSvgProlog(highlightBodySvg(maleBackSvg, labels)) }
  }, [muscleScores])
  const maxMuscleScore = Math.max(1, ...muscleScores.map((item) => item.score))
  const shareText = data ? buildTrainingShareText(data, API_BASE_URL) : ''

  async function copyText() {
    if (!shareText) return
    try {
      await Clipboard.setStringAsync(shareText)
      Alert.alert('已复制', '分享内容已复制，可直接粘贴发送。')
    } catch {
      Alert.alert('复制失败', '无法写入剪贴板，请稍后重试。')
    }
  }

  async function shareCard() {
    if (!shareText || sharing) return
    setSharing(true)
    try {
      await Share.share({ message: shareText })
    } catch (shareError) {
      Alert.alert('分享失败', errorMessage(shareError, '请稍后重试'))
    } finally {
      setSharing(false)
    }
  }

  return (
    <ScreenShell title="分享训练" subtitle="把这次训练发给朋友" onBack={() => navigation.goBack()}>
      {!executionId ? <EmptyState title="没有可分享的训练" desc="请从训练记录里选择一次已完成的训练。" /> : null}
      {executionId && loading && !data ? <LoadingState title="正在加载分享数据" /> : null}
      {error && !data ? (
        <Card>
          <Text style={styles.error}>{error}</Text>
          <SolidButton label="重新加载" variant="secondary" onPress={() => setReloadKey((key) => key + 1)} />
        </Card>
      ) : null}

      {data ? (
        <>
          <Card>
            <View style={styles.header}>
              <InlineAvatar uri={data.avatarUrl} label={data.nickname || '练'} size={56} />
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>TRAINING COMPLETE</Text>
                <Text style={styles.title} numberOfLines={2}>{data.nickname ? `${data.nickname} 完成训练` : trainingShareTitle('', data.planName)}</Text>
                <Text style={styles.meta}>{[formatShareDateTime(data.completedAt), data.planName].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>

            <View style={styles.bodyRow}>
              <BodyMap xml={bodyMaps.front} caption="正面" />
              <BodyMap xml={bodyMaps.back} caption="背面" />
            </View>

            <View style={styles.statsRow}>
              <Stat value={String(volumeInTons(data.totalVolume))} label="总容量 t" />
              <Stat value={String(data.totalSets)} label="完成组数" />
              <Stat value={data.durationMinutes ? String(data.durationMinutes) : '-'} label="分钟" />
            </View>
            {data.prCount > 0 ? <Text style={styles.pr}>本次刷新 {data.prCount} 项 PR</Text> : null}

            <View style={styles.muscles}>
              {(muscleScores.length ? muscleScores : [{ label: '全身', score: 1 }]).slice(0, 5).map((item) => (
                <View key={item.label} style={styles.muscleRow}>
                  <Text style={styles.muscleName}>{item.label}</Text>
                  <View style={styles.muscleTrack}>
                    <View style={[styles.muscleFill, { width: `${Math.max(12, Math.round((item.score / maxMuscleScore) * 100))}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>训练明细</Text>
            {data.actions.length === 0 ? <Text style={styles.meta}>暂无详细动作记录</Text> : null}
            {data.actions.map((action, index) => (
              <View key={`${action.actionName}-${index}`} style={styles.actionRow}>
                <Text style={styles.actionIndex}>{index + 1}</Text>
                <Text style={styles.actionName} numberOfLines={2}>{action.actionName}</Text>
                <Text style={styles.badge}>{action.setsCount} 组</Text>
                {action.volume > 0 ? <Text style={styles.meta}>{action.volume} kg</Text> : null}
              </View>
            ))}
          </Card>

          <SolidButton label="分享给朋友" loading={sharing} onPress={() => void shareCard()} />
          <SolidButton label="复制分享内容" variant="secondary" onPress={() => void copyText()} />
        </>
      ) : null}
    </ScreenShell>
  )
}

function BodyMap({ xml, caption }: { xml: string; caption: string }) {
  return (
    <View style={styles.bodyMap}>
      <View style={styles.bodyImage}>
        <SvgXml xml={xml} width="100%" height="100%" />
      </View>
      <Text style={styles.meta}>{caption}</Text>
    </View>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { color: colors.brand, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  bodyRow: { flexDirection: 'row', gap: spacing.xs },
  bodyMap: { flex: 1, height: 176, alignItems: 'center', gap: 4, padding: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  bodyImage: { flex: 1, width: '100%' },
  statsRow: { flexDirection: 'row', gap: spacing.xs },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  pr: { color: colors.brand, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  muscles: { gap: spacing.xs },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  muscleName: { width: 40, color: colors.textSecondary, fontSize: 12 },
  muscleTrack: { flex: 1, height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  muscleFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  actionRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionIndex: { width: 24, height: 24, overflow: 'hidden', borderRadius: radius.pill, textAlign: 'center', lineHeight: 24, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 12, fontWeight: '600' },
  actionName: { flex: 1, color: colors.text, fontSize: 14 },
  badge: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '600' },
})
