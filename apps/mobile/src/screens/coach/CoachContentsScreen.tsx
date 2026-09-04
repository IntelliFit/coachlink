import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RouteProp } from '@react-navigation/native'
import { IconFont } from '../../components/IconFont'
import type { RootStackParamList } from '../../navigation/types'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import { Card, EmptyState, FormField, LoadingState, ScreenShell, SolidButton, safeRequest } from '../me/MeShared'

type Navigation = NativeStackNavigationProp<RootStackParamList>
type ContentType = 'text' | 'video' | 'image' | 'live' | 'plan'
type TypeFilter = 'all' | ContentType
type TierFilter = 'all' | 0 | 1 | 2 | 3

const CONTENT_TYPES: Array<{ label: string; value: TypeFilter }> = [
  { label: '全部类型', value: 'all' },
  { label: '图文', value: 'text' },
  { label: '视频', value: 'video' },
  { label: '图片', value: 'image' },
  { label: '直播', value: 'live' },
  { label: '计划', value: 'plan' },
]

const EDIT_CONTENT_TYPES: Array<{ label: string; value: ContentType }> = [
  { label: '图文文章', value: 'text' },
  { label: '视频内容', value: 'video' },
  { label: '图片内容', value: 'image' },
  { label: '直播预告', value: 'live' },
  { label: '训练计划', value: 'plan' },
]

const TIER_OPTIONS: Array<{ label: string; value: TierFilter; desc?: string }> = [
  { label: '全部权限', value: 'all' },
  { label: '所有人', value: 0, desc: '未订阅学员也能查看' },
  { label: '仅订阅', value: 1, desc: '与 Web 教练端的订阅可见一致' },
  { label: '高级订阅', value: 2, desc: '保留给更高等级套餐' },
  { label: 'VIP', value: 3, desc: '仅最高等级用户可见' },
]

function stripHtml(input: unknown) {
  return String(input || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function dateText(value?: string | null) {
  if (!value) return '暂无时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无时间'
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function typeLabel(value?: string | null) {
  return EDIT_CONTENT_TYPES.find((item) => item.value === value)?.label.replace('内容', '').replace('文章', '') || '内容'
}

function tierLabel(value?: number | null) {
  const map: Record<number, string> = {
    0: '所有人可见',
    1: '仅订阅可见',
    2: '高级订阅可见',
    3: 'VIP 可见',
  }
  return map[Number(value ?? 0)] || '所有人可见'
}

function priceText(value?: number | null) {
  const cents = Number(value ?? 0)
  if (!Number.isFinite(cents) || cents <= 0) return '免费'
  return `¥${(cents / 100).toFixed(2)}`
}

function parseTags(text: string) {
  return text.split(/[,\n，、#]/).map((item) => item.trim()).filter(Boolean)
}

export function CoachContentsScreen() {
  const navigation = useNavigation<Navigation>()
  const { user } = useAuth()
  const [coachId, setCoachId] = useState('')
  const [contents, setContents] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return contents.filter((item) => {
      const matchesKeyword = !keyword || String(item?.title || '').toLowerCase().includes(keyword) || stripHtml(item?.content).toLowerCase().includes(keyword)
      const matchesType = typeFilter === 'all' || item?.content_type === typeFilter
      const matchesTier = tierFilter === 'all' || Number(item?.required_tier ?? 0) === tierFilter
      return matchesKeyword && matchesType && matchesTier
    })
  }, [contents, search, tierFilter, typeFilter])

  const stats = useMemo(() => ({
    total: contents.length,
    free: contents.filter((item) => Number(item?.required_tier ?? 0) === 0).length,
    subscription: contents.filter((item) => Number(item?.required_tier ?? 0) > 0).length,
    featured: contents.filter((item) => Boolean(item?.is_featured)).length,
  }), [contents])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const coachRes = await safeRequest<any>('/api/coach/get-coach', { body: { userId: user?.id } })
      const ownCoachId = coachRes?.coach?.id
      if (!ownCoachId) {
        setCoachId('')
        setContents([])
        setError('当前账号没有可管理的教练身份。')
        return
      }
      setCoachId(ownCoachId)
      const contentRes = await safeRequest<any>('/api/coach/get-contents', { body: { coachId: ownCoachId, limit: 100, offset: 0 } })
      setContents(Array.isArray(contentRes?.contents) ? contentRes.contents : [])
    } catch (e) {
      setContents([])
      setError(e instanceof Error ? e.message : '内容库加载失败')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void load()
  }, [load])

  async function deleteContent(content: any) {
    try {
      await safeRequest('/api/coach/delete-content', { body: { id: content.id } })
      await load()
    } catch (e) {
      Alert.alert('删除失败', e instanceof Error ? e.message : '请稍后重试')
    }
  }

  return (
    <ScreenShell title="内容管理" subtitle="按类型、权益和精选状态管理文章、视频和计划。" onBack={() => navigation.goBack()}>
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>内容管理</Text>
            <Text style={styles.heroTitle}>按类型、权益和精选状态来管内容</Text>
            <Text style={styles.heroDesc}>先看全量内容，再按可见范围和内容类型筛选，保持和小程序教练后台一致。</Text>
          </View>
          <Pressable disabled={!coachId} onPress={() => navigation.navigate('CoachContentEdit')} style={[styles.createButton, !coachId && styles.disabled]}>
            <Text style={styles.createText}>新建</Text>
          </Pressable>
        </View>
      </Card>

      <View style={styles.statsGrid}>
        <StatCard label="内容总数" value={stats.total} />
        <StatCard label="所有人可见" value={stats.free} />
        <StatCard label="订阅可见" value={stats.subscription} />
        <StatCard label="精选内容" value={stats.featured} />
      </View>

      <Card style={styles.toolbar}>
        <View style={styles.searchRow}>
          <IconFont name="icon-search" size={20} color={colors.textMuted} />
          <TextInput value={search} onChangeText={setSearch} placeholder="搜索标题或正文关键词" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
        </View>
        <Text style={styles.filterLabel}>可见范围</Text>
        <View style={styles.filterRow}>
          {TIER_OPTIONS.map((item) => (
            <Pressable key={String(item.value)} accessibilityRole="radio" accessibilityLabel={`筛选可见范围：${item.label}`} accessibilityState={{ selected: tierFilter === item.value }} onPress={() => setTierFilter(item.value)} style={[styles.chip, tierFilter === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, tierFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.filterLabel}>内容类型</Text>
        <View style={styles.filterRow}>
          {CONTENT_TYPES.map((item) => (
            <Pressable key={String(item.value)} accessibilityRole="radio" accessibilityLabel={`筛选内容类型：${item.label}`} accessibilityState={{ selected: typeFilter === item.value }} onPress={() => setTypeFilter(item.value)} style={[styles.chip, typeFilter === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, typeFilter === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {loading ? <LoadingState title="正在加载内容库" /> : null}
      {!loading && error ? <EmptyState title="加载失败" desc={error} icon="icon-knowledge" /> : null}
      {!loading && !error && filtered.length === 0 ? <EmptyState title="没有匹配的内容" desc="可以尝试调整搜索词、权限范围或内容类型筛选。" icon="icon-knowledge" /> : null}

      {!loading && !error ? filtered.map((item) => {
        const plain = stripHtml(item?.content)
        return (
          <Card key={String(item.id)} style={styles.contentCard}>
            <View style={styles.contentHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contentTitle}>{item?.title || '未命名内容'}</Text>
                <Text style={styles.contentMeta}>更新于 {dateText(item?.updated_at || item?.created_at)}</Text>
              </View>
              {item?.is_featured ? <Text style={styles.featuredBadge}>精选</Text> : null}
            </View>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{typeLabel(item?.content_type)}</Text>
              <Text style={styles.badge}>{tierLabel(item?.required_tier)}</Text>
              <Text style={[styles.badge, Number(item?.price_cents ?? 0) > 0 ? styles.paidBadge : styles.freeBadge]}>{priceText(item?.price_cents)}</Text>
            </View>
            <Text style={styles.excerpt}>{plain.slice(0, 88) || '暂无内容摘要'}{plain.length > 88 ? '...' : ''}</Text>
            {Array.isArray(item?.tags) && item.tags.length > 0 ? (
              <View style={styles.tagRow}>
                {item.tags.slice(0, 4).map((tag: string) => <Text key={`${item.id}-${tag}`} style={styles.tagText}>#{tag}</Text>)}
              </View>
            ) : null}
            <View style={styles.metricRow}>
              <Text style={styles.metricText}>浏览 {Number(item?.views_count ?? 0)}</Text>
              <Text style={styles.metricText}>点赞 {Number(item?.likes_count ?? 0)}</Text>
              <Text style={styles.metricText}>评论 {Number(item?.comments_count ?? 0)}</Text>
            </View>
            <View style={styles.actionRow}>
              <SolidButton label="编辑" variant="secondary" onPress={() => navigation.navigate('CoachContentEdit', { id: item.id })} />
              <SolidButton label="删除" variant="danger" onPress={() => Alert.alert('确认删除', `确定删除「${item?.title || '未命名内容'}」吗？删除后无法恢复。`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deleteContent(item) }])} />
            </View>
          </Card>
        )
      }) : null}
    </ScreenShell>
  )
}

export function CoachContentEditScreen() {
  const navigation = useNavigation<Navigation>()
  const route = useRoute<RouteProp<RootStackParamList, 'CoachContentEdit'>>()
  const { user } = useAuth()
  const contentId = route.params?.id
  const isEdit = Boolean(contentId)
  const [loading, setLoading] = useState(Boolean(contentId))
  const [saving, setSaving] = useState(false)
  const [coachId, setCoachId] = useState('')
  const [form, setForm] = useState({
    title: '',
    content: '',
    contentType: 'text' as ContentType,
    requiredTier: 0,
    price: '0',
    tags: '',
    isFeatured: false,
  })

  const patch = (next: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...next }))

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const coachRes = await safeRequest<any>('/api/coach/get-coach', { body: { userId: user?.id } })
        const ownCoachId = coachRes?.coach?.id
        if (!ownCoachId) throw new Error('当前账号没有可管理的教练身份。')
        setCoachId(ownCoachId)
        if (!contentId) return
        const contentRes = await safeRequest<any>('/api/coach/get-contents', { body: { coachId: ownCoachId, limit: 100, offset: 0 } })
        const found = Array.isArray(contentRes?.contents) ? contentRes.contents.find((item: any) => item.id === contentId) : null
        if (!found) throw new Error('未找到要编辑的内容')
        setForm({
          title: found.title || '',
          content: found.content || '',
          contentType: found.content_type || 'text',
          requiredTier: Number(found.required_tier ?? 0),
          price: found.price_cents ? String(Number(found.price_cents) / 100) : '0',
          tags: Array.isArray(found.tags) ? found.tags.join('、') : '',
          isFeatured: Boolean(found.is_featured),
        })
      } catch (e) {
        Alert.alert('加载失败', e instanceof Error ? e.message : '内容加载失败')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [contentId, user?.id])

  async function save(isDraft = false) {
    if (!form.title.trim()) {
      Alert.alert('缺少标题', '请输入标题。')
      return
    }
    if (!form.content.trim()) {
      Alert.alert('缺少内容', '请输入内容。')
      return
    }
    if (!coachId) {
      Alert.alert('无法保存', '教练信息加载失败。')
      return
    }
    const priceCents = Math.max(0, Math.floor(Number(form.price || '0') * 100))
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      content: form.content.trim(),
      content_type: form.contentType,
      required_tier: form.requiredTier,
      price_cents: priceCents,
      tags: parseTags(form.tags),
      is_featured: form.isFeatured,
      isDraft,
    }
    if (isEdit) payload.id = contentId
    else payload.coachId = coachId

    try {
      setSaving(true)
      await safeRequest(isEdit ? '/api/coach/update-content' : '/api/coach/publish-content', { body: payload })
      navigation.goBack()
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : '请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title={isEdit ? '编辑内容' : '新建内容'} onBack={() => navigation.goBack()}>
        <LoadingState title="正在加载内容" />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title={isEdit ? '编辑内容' : '新建内容'} subtitle="标题、正文、权益、价格、标签和精选状态与小程序保持一致。" onBack={() => navigation.goBack()}>
      <Card style={styles.formCard}>
        <FormField label="标题" value={form.title} onChangeText={(title) => patch({ title })} />
        <Text style={styles.fieldLabel}>内容</Text>
        <TextInput value={form.content} onChangeText={(content) => patch({ content })} multiline placeholder="请输入内容" placeholderTextColor={colors.textMuted} style={styles.textarea} />
        <Text style={styles.fieldLabel}>内容类型</Text>
        <View style={styles.filterRow}>
          {EDIT_CONTENT_TYPES.map((item) => (
            <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={`内容类型：${item.label}`} accessibilityState={{ selected: form.contentType === item.value }} onPress={() => patch({ contentType: item.value })} style={[styles.chip, form.contentType === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, form.contentType === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.fieldLabel}>可见范围</Text>
        <View style={styles.filterRow}>
          {TIER_OPTIONS.filter((item) => item.value !== 'all').map((item) => (
            <Pressable key={String(item.value)} accessibilityRole="radio" accessibilityLabel={`可见范围：${item.label}`} accessibilityState={{ selected: form.requiredTier === item.value }} onPress={() => patch({ requiredTier: item.value as number })} style={[styles.chip, form.requiredTier === item.value && styles.chipActive]}>
              <Text style={[styles.chipText, form.requiredTier === item.value && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hintText}>{TIER_OPTIONS.find((item) => item.value === form.requiredTier)?.desc || '未订阅学员也能查看'}</Text>
        <FormField label="价格（元）" value={form.price} onChangeText={(price) => patch({ price })} keyboardType="numeric" placeholder="0.00" />
        <Text style={styles.hintText}>0 元表示免费内容。</Text>
        <FormField label="标签" value={form.tags} onChangeText={(tags) => patch({ tags })} placeholder="增肌、动作标准、计划" />
        <CheckRow label="设为精选内容" desc="会在内容列表中突出显示" value={form.isFeatured} onChange={() => patch({ isFeatured: !form.isFeatured })} />
      </Card>
      <View style={styles.actionRow}>
        <SolidButton label="保存草稿" variant="secondary" loading={saving} onPress={() => void save(true)} />
        <SolidButton label={isEdit ? '更新发布' : '立即发布'} loading={saving} onPress={() => void save(false)} />
      </View>
    </ScreenShell>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  )
}

function CheckRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: () => void }) {
  return (
    <Pressable onPress={onChange} style={styles.checkRow}>
      <View style={[styles.checkBox, value && styles.checkBoxOn]}>
        {value ? <IconFont name="icon-goumaijilu" size={16} color={colors.surface} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkDesc}>{desc}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroCopy: { flex: 1, gap: 4 },
  heroEyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  heroDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  createButton: { minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  createText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '47%', gap: 4 },
  statLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  toolbar: { gap: spacing.sm },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  filterLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: colors.surface },
  contentCard: { gap: spacing.sm },
  contentHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  contentTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  contentMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  featuredBadge: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#FFF3D6', color: '#A66A00', fontSize: 12, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  freeBadge: { backgroundColor: '#EAFBF6', color: '#098B72' },
  paidBadge: { backgroundColor: colors.brandSoft, color: colors.brand },
  excerpt: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tagText: { color: colors.brand, fontSize: 12, fontWeight: '800' },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  formCard: { gap: spacing.sm },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '900' },
  textarea: { minHeight: 180, borderRadius: radius.md, padding: spacing.sm, color: colors.text, fontSize: 15, lineHeight: 22, backgroundColor: colors.surfaceMuted, textAlignVertical: 'top' },
  hintText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  checkBox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkBoxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkLabel: { color: colors.text, fontSize: 15, fontWeight: '900' },
  checkDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
})
