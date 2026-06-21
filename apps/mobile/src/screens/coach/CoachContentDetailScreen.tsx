import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { apiClient } from '../../api'
import { IconFont } from '../../components/IconFont'
import { SectionCard } from '../../components/SectionCard'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'CoachContentDetail'>

type ContentResponse = {
  content: any | null
  accessTier?: number
}

function stripHtml(input?: string | null) {
  if (!input) return ''
  return String(input)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN')
}

function mediaUrls(content: any) {
  const value = content?.media_urls || content?.mediaUrls || []
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

export function CoachContentDetailScreen({ navigation, route }: Props) {
  const contentId = route.params?.id || ''
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<any | null>(null)
  const [accessTier, setAccessTier] = useState(0)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    if (!contentId) {
      setError('缺少内容 ID')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    setForbidden(false)
    setContent(null)
    try {
      const data = await apiClient.request<ContentResponse>('/api/coach/get-content-by-id', {
        method: 'POST',
        body: { contentId },
        timeoutMs: 15000,
      })
      setContent(data.content || null)
      setAccessTier(Number(data.accessTier || 0))
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败'
      if (message.includes('权限') || message.includes('无权限')) setForbidden(true)
      else setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [contentId])

  const bodyText = useMemo(() => stripHtml(content?.content), [content?.content])
  const urls = mediaUrls(content)
  const isVideo = String(content?.content_type || '').toLowerCase() === 'video'
  const canView = content && Number(content.required_tier || 0) <= accessTier

  async function copyMediaUrl(url: string) {
    await Clipboard.setStringAsync(url)
    Alert.alert('链接已复制')
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.loadingText}>正在加载教学内容</Text>
      </View>
    )
  }

  if (forbidden || (content && !canView)) {
    return (
      <View style={styles.center}>
        <IconFont name="icon-vips" size={42} color={colors.brand} />
        <Text style={styles.stateTitle}>订阅后可见</Text>
        <Text style={styles.stateDesc}>该内容需要订阅教练后才能查看，返回教练主页选择合适套餐。</Text>
        <Pressable onPress={navigation.goBack} style={styles.primaryButton}><Text style={styles.primaryText}>返回教练主页</Text></Pressable>
      </View>
    )
  }

  if (error || !content) {
    return (
      <View style={styles.center}>
        <IconFont name="icon-wenhao" size={42} color={colors.brand} />
        <Text style={styles.stateTitle}>{error || '内容不存在或已删除'}</Text>
        <Pressable onPress={navigation.goBack} style={styles.primaryButton}><Text style={styles.primaryText}>返回</Text></Pressable>
      </View>
    )
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={navigation.goBack} style={styles.backButton}>
            <IconFont name="icon-back" size={20} color={colors.brand} />
          </Pressable>
          <Text style={styles.headerTitle}>教学内容</Text>
        </View>

        <View style={styles.titleCard}>
          <Text style={styles.title}>{content.title || '未命名内容'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{content.views_count != null ? `浏览 ${content.views_count}` : '教练专栏'}</Text>
            {content.created_at ? <Text style={styles.meta}>{formatDate(content.created_at)}</Text> : null}
          </View>
        </View>

        {urls.length > 0 ? (
          <SectionCard title={isVideo ? '视频内容' : '内容图片'}>
            {urls.map((url, index) => (
              <View key={`${url}-${index}`} style={styles.mediaItem}>
                {isVideo ? (
                  <>
                    <Text style={styles.videoHint}>APP 端暂以外部链接打开视频。</Text>
                    <Text selectable style={styles.linkText}>{url}</Text>
                    <View style={styles.mediaActions}>
                      <Pressable onPress={() => Linking.openURL(url)} style={styles.secondaryButton}><Text style={styles.secondaryText}>打开视频</Text></Pressable>
                      <Pressable onPress={() => copyMediaUrl(url)} style={styles.secondaryButton}><Text style={styles.secondaryText}>复制链接</Text></Pressable>
                    </View>
                  </>
                ) : (
                  <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
                )}
              </View>
            ))}
          </SectionCard>
        ) : null}

        {bodyText ? (
          <SectionCard title="正文">
            <Text style={styles.bodyText}>{bodyText}</Text>
          </SectionCard>
        ) : null}

        {Array.isArray(content.tags) && content.tags.length > 0 ? (
          <View style={styles.tags}>
            {content.tags.map((tag: string, index: number) => <Text key={`${tag}-${index}`} style={styles.tag}>#{tag}</Text>)}
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, paddingBottom: 128, gap: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.background },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  stateTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stateDesc: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  titleCard: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 32 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  mediaItem: { gap: spacing.xs },
  image: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  videoHint: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  linkText: { color: colors.brand, fontSize: 13, lineHeight: 20 },
  mediaActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  primaryButton: { minHeight: 44, minWidth: 160, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.brand, paddingHorizontal: spacing.md },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  bodyText: { color: colors.text, fontSize: 15, lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4, color: colors.brand, backgroundColor: colors.brandSoft, fontSize: 12, fontWeight: '900' },
})
