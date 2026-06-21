import { useEffect, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { apiClient } from '../../api'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<RootStackParamList, 'StreetliftingLocations'>

type StreetliftingLocation = {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  province: string | null
  county: string | null
  image_url: string | null
  image_urls: string[] | null
  latitude: number | null
  longitude: number | null
  created_at: string
  user_contact?: string | null
  contributor_name_snapshot?: string | null
}

type LocationOverview = {
  totalCount: number
  withImagesCount: number
  withDescriptionCount: number
  averageImageCount: number
  provinceCount: number
  mapReadyCount: number
  contributorCount: number
  topProvinces: Array<{ name: string; count: number }>
  topCities: Array<{ name: string; count: number }>
}

type ListRes = {
  locations: StreetliftingLocation[]
  pagination: { page: number; limit: number; total: number }
  provinces: string[]
}

const PAGE_SIZE = 20

function getLocationImages(location: StreetliftingLocation) {
  if (Array.isArray(location.image_urls) && location.image_urls.length) return location.image_urls
  if (location.image_url) return [location.image_url]
  return []
}

function locationArea(location: StreetliftingLocation) {
  return [location.province, location.city, location.county].filter(Boolean).join(' · ') || '未补充区域'
}

function contributorName(location: StreetliftingLocation) {
  return location.contributor_name_snapshot || location.user_contact || '未署名贡献者'
}

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function StreetliftingLocationsScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<StreetliftingLocation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [provinces, setProvinces] = useState<string[]>([])
  const [province, setProvince] = useState('all')
  const [search, setSearch] = useState('')
  const [overview, setOverview] = useState<LocationOverview | null>(null)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    province: '',
    city: '',
    county: '',
    latitude: '',
    longitude: '',
    user_contact: '',
  })

  const visibleProvinceOptions = useMemo(() => ['all', ...provinces], [provinces])

  const loadOverview = async () => {
    try {
      const stats = await apiClient.request<{ locationOverview: LocationOverview }>('/api/streetlifting-index/stats', { method: 'POST', body: {}, timeoutMs: 12000 })
      setOverview(stats.locationOverview)
    } catch {
      setOverview(null)
    }
  }

  const loadLocations = async (targetPage = 1, append = false) => {
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<ListRes>('/api/streetlifting-index/locations/list', {
        method: 'POST',
        body: { page: targetPage, limit: PAGE_SIZE, search: search.trim() || undefined, province: province === 'all' ? undefined : province },
        timeoutMs: 12000,
      })
      const sorted = [...(data.locations || [])].sort((a, b) => getLocationImages(b).length - getLocationImages(a).length || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setLocations((prev) => (append ? [...prev, ...sorted] : sorted))
      setTotal(data.pagination?.total || sorted.length)
      setPage(targetPage)
      setProvinces(data.provinces || [])
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations(1, false)
    loadOverview()
  }, [])

  const applyFilter = () => loadLocations(1, false)

  const createLocation = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        province: form.province.trim() || null,
        city: form.city.trim() || null,
        county: form.county.trim() || null,
        latitude: form.latitude.trim() ? Number(form.latitude) : null,
        longitude: form.longitude.trim() ? Number(form.longitude) : null,
        image_urls: [],
        user_contact: form.user_contact.trim() || null,
      }
      if (!payload.name) throw new Error('请填写地点名称')
      if ((payload.latitude !== null && !Number.isFinite(payload.latitude)) || (payload.longitude !== null && !Number.isFinite(payload.longitude))) {
        throw new Error('经纬度格式不正确')
      }
      const res = await apiClient.request<{ location: StreetliftingLocation }>('/api/streetlifting-index/locations/create', {
        method: 'POST',
        body: payload,
        timeoutMs: 12000,
      })
      setLocations((prev) => [res.location, ...prev])
      setTotal((prev) => prev + 1)
      setDialogOpen(false)
    } catch (e) {
      setError((e as Error)?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Page>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <IconFont name="icon-back" color={colors.text} size={18} />
        <Text style={styles.backText}>返回</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>街健指数</Text>
          <Text style={styles.heroTitle}>单杠位置</Text>
          <Text style={styles.heroSubtitle}>查找、筛选和贡献单杠点位，优先展示有图片与信息更完整的位置。</Text>
        </View>
        <View style={styles.heroIcon}>
          <IconFont name="icon-location" color={colors.brand} size={30} />
        </View>
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.totalCount ?? total}</Text><Text style={styles.statLabel}>点位</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.withImagesCount ?? 0}</Text><Text style={styles.statLabel}>有图片</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.provinceCount ?? provinces.length}</Text><Text style={styles.statLabel}>省份</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.mapReadyCount ?? 0}</Text><Text style={styles.statLabel}>可导航</Text></View>
      </View>

      <SectionCard title="筛选">
        <TextInput value={search} onChangeText={setSearch} placeholder="搜索名称、地址或描述" placeholderTextColor={colors.textMuted} style={styles.input} />
        <View style={styles.chips}>
          {visibleProvinceOptions.slice(0, 12).map((item) => {
            const active = province === item
            return (
              <Pressable key={item} onPress={() => setProvince(item)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item === 'all' ? '全部省份' : item}</Text>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.actions}>
          <Pressable onPress={applyFilter} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>应用筛选</Text></Pressable>
          <Pressable onPress={() => setDialogOpen(true)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>新增点位</Text></Pressable>
        </View>
        <Pressable onPress={() => navigation.navigate('StreetliftingLocationsMap')} style={styles.mapButton}>
          <IconFont name="icon-location" color={colors.brand} size={18} />
          <Text style={styles.mapButtonText}>查看可导航点位地图</Text>
        </Pressable>
      </SectionCard>

      {overview?.topProvinces?.length ? (
        <SectionCard title="热门区域">
          <View style={styles.areaList}>
            {overview.topProvinces.slice(0, 6).map((item) => (
              <View key={item.name} style={styles.areaRow}>
                <Text style={styles.areaName}>{item.name}</Text>
                <Text style={styles.areaCount}>{item.count} 个点位</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading && !locations.length ? (
        <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载点位</Text></View>
      ) : (
        <View style={styles.list}>
          {locations.map((location) => {
            const image = getLocationImages(location)[0]
            return (
              <Pressable key={location.id} onPress={() => navigation.navigate('StreetliftingLocationDetail', { id: location.id })} style={styles.locationCard}>
                {image ? <Image source={{ uri: image }} style={styles.locationImage} /> : <View style={styles.imageFallback}><IconFont name="icon-location" color={colors.brand} size={28} /></View>}
                <View style={styles.locationBody}>
                  <Text style={styles.locationTitle}>{location.name}</Text>
                  <Text style={styles.locationArea}>{locationArea(location)}</Text>
                  {location.description ? <Text style={styles.locationDesc}>{location.description}</Text> : null}
                  {location.address ? <Text style={styles.locationMeta}>{location.address}</Text> : null}
                  <View style={styles.locationFooter}>
                    <Text style={styles.footerText}>{contributorName(location)} · {formatDate(location.created_at)}</Text>
                    {location.latitude && location.longitude ? <Text style={styles.mapReady}>可导航</Text> : null}
                  </View>
                </View>
              </Pressable>
            )
          })}
          {locations.length < total ? (
            <Pressable onPress={() => loadLocations(page + 1, true)} style={styles.loadMoreButton}>
              <Text style={styles.loadMoreText}>{loading ? '加载中' : '加载更多'}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <Modal visible={dialogOpen} animationType="slide" transparent onRequestClose={() => setDialogOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>新增单杠点位</Text>
            <TextInput value={form.name} onChangeText={(name) => setForm((prev) => ({ ...prev, name }))} placeholder="地点名称" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.description} onChangeText={(description) => setForm((prev) => ({ ...prev, description }))} placeholder="描述" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.address} onChangeText={(address) => setForm((prev) => ({ ...prev, address }))} placeholder="详细地址" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.province} onChangeText={(provinceValue) => setForm((prev) => ({ ...prev, province: provinceValue }))} placeholder="省份" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.city} onChangeText={(city) => setForm((prev) => ({ ...prev, city }))} placeholder="城市" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.county} onChangeText={(county) => setForm((prev) => ({ ...prev, county }))} placeholder="区县" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.latitude} onChangeText={(latitude) => setForm((prev) => ({ ...prev, latitude }))} keyboardType="decimal-pad" placeholder="纬度（可选）" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.longitude} onChangeText={(longitude) => setForm((prev) => ({ ...prev, longitude }))} keyboardType="decimal-pad" placeholder="经度（可选）" placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput value={form.user_contact} onChangeText={(user_contact) => setForm((prev) => ({ ...prev, user_contact }))} placeholder="署名/联系方式（可选）" placeholderTextColor={colors.textMuted} style={styles.input} />
            <View style={styles.actions}>
              <Pressable onPress={() => setDialogOpen(false)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>取消</Text></Pressable>
              <Pressable onPress={createLocation} disabled={submitting} style={[styles.primaryButton, submitting && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{submitting ? '提交中' : '提交'}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  )
}

const styles = StyleSheet.create({
  backRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  backText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  hero: { minHeight: 152, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F' },
  heroText: { flex: 1, gap: spacing.xs },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '47%', borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 15, fontWeight: '800', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  mapButton: { minHeight: 48, marginTop: spacing.sm, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.brandSoft },
  mapButtonText: { color: colors.brand, fontSize: 14, fontWeight: '900' },
  primaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  buttonDisabled: { opacity: 0.55 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  loadingCard: { minHeight: 96, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface },
  loadingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800' },
  areaList: { gap: spacing.xs },
  areaRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, paddingHorizontal: spacing.sm, backgroundColor: colors.surfaceMuted },
  areaName: { color: colors.text, fontSize: 14, fontWeight: '900' },
  areaCount: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  list: { gap: spacing.sm },
  locationCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  locationImage: { width: '100%', height: 160 },
  imageFallback: { height: 144, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  locationBody: { padding: spacing.sm, gap: spacing.xs },
  locationTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  locationArea: { color: colors.brand, fontSize: 13, fontWeight: '900' },
  locationDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  locationMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  locationFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerText: { flex: 1, color: colors.textMuted, fontSize: 12 },
  mapReady: { color: colors.success, fontSize: 12, fontWeight: '900' },
  loadMoreButton: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  loadMoreText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { maxHeight: '88%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
})
