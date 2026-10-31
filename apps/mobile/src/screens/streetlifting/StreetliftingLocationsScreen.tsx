import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { LocationEquipmentType } from '@coachlink/core'
import { IconFont } from '../../components/IconFont'
import { Page } from '../../components/Page'
import { SectionCard } from '../../components/SectionCard'
import { apiClient } from '../../api'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, shadow, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { EquipmentSelector, EquipmentTags } from './LocationEquipment'
import { NearbyLocationCard } from './NearbyLocationCard'
import { openSystemMap } from './StreetliftingExtraScreens'
import { explainLocationError, getCurrentPosition, LocationPermissionError } from './userLocation'
import { StreetliftingLocationFormModal } from './StreetliftingLocationFormModal'
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import {
  contributorLabel,
  formatContributorName,
  formatMonthLabel,
  formatRate,
  getLocationImages,
  locationRegion,
  sortLocations,
  type LocationContributor,
  type LocationOverview,
  type StreetliftingLocation,
  consumeLocationsChanged,
  nearestLocations,
  type LocationMapPin,
} from './locationModel'

type Props = NativeStackScreenProps<RootStackParamList, 'StreetliftingLocations'>

type ListRes = {
  locations: StreetliftingLocation[]
  pagination: { page: number; limit: number; total: number }
  provinces: string[]
  countries?: string[]
}

const PAGE_SIZE = 20
const TABS = [
  { key: 'list', label: '单杠列表' },
  { key: 'data', label: '单杠数据' },
  { key: 'rank', label: '贡献排行榜' },
] as const
type TabKey = (typeof TABS)[number]['key']

function formatDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return toBeijingDateKey(date)
}

/** 单杠点位，对应小程序 streetlifting/index/locations：列表筛选、数据、贡献榜，分享和编辑点位。 */
export function StreetliftingLocationsScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<TabKey>('list')
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<StreetliftingLocation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [provinces, setProvinces] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>(['中国'])
  const [province, setProvince] = useState('all')
  const [country, setCountry] = useState('all')
  const [equipment, setEquipment] = useState<LocationEquipmentType[]>([])
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [overview, setOverview] = useState<LocationOverview | null>(null)
  const [contributors, setContributors] = useState<LocationContributor[]>([])
  const [loadingContributors, setLoadingContributors] = useState(false)
  const [error, setError] = useState('')
  const [formVisible, setFormVisible] = useState(false)
  const [editing, setEditing] = useState<StreetliftingLocation | null>(null)
  // 筛选切换很快时，只采用最后一次请求的结果
  const requestIdRef = useRef(0)
  const [userPosition, setUserPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [nearbyPins, setNearbyPins] = useState<LocationMapPin[]>([])
  const nearby = useMemo(() => (userPosition ? nearestLocations(userPosition, nearbyPins, equipment) : []), [equipment, nearbyPins, userPosition])

  async function locateNearby() {
    if (locating) return
    setLocating(true)
    try {
      const position = await getCurrentPosition()
      const pins = await apiClient.request<LocationMapPin[]>('/api/streetlifting-index/locations/map-pins', { method: 'POST', body: {}, timeoutMs: 15000 })
      setNearbyPins(Array.isArray(pins) ? pins : [])
      setUserPosition(position)
    } catch (locateError) {
      if (locateError instanceof LocationPermissionError) {
        explainLocationError(locateError, '需要允许定位后才能查看附近单杠。你也可以继续浏览单杠地图。')
      } else {
        Alert.alert('定位失败', `${locateError instanceof Error ? locateError.message : '定位暂不可用。'}也可以打开地图，用「定位我附近」再试一次。`, [
          { text: '取消', style: 'cancel' },
          { text: '打开地图', onPress: () => navigation.navigate('StreetliftingLocationsMap') },
        ])
      }
    } finally {
      setLocating(false)
    }
  }

  const loadOverview = async () => {
    try {
      const stats = await apiClient.request<{ locationOverview: LocationOverview }>('/api/streetlifting-index/stats', { method: 'POST', body: {}, timeoutMs: 12000 })
      setOverview(stats.locationOverview)
    } catch {
      setOverview(null)
    }
  }

  const loadContributors = async () => {
    setLoadingContributors(true)
    try {
      const data = await apiClient.request<{ contributors: LocationContributor[] }>('/api/streetlifting-index/locations/contributors', { method: 'POST', body: {}, timeoutMs: 15000 })
      setContributors(Array.isArray(data?.contributors) ? data.contributors : [])
    } catch {
      setContributors([])
    } finally {
      setLoadingContributors(false)
    }
  }

  const loadLocations = async (targetPage = 1, append = false) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    try {
      const data = await apiClient.request<ListRes>('/api/streetlifting-index/locations/list', {
        method: 'POST',
        body: {
          page: targetPage,
          limit: PAGE_SIZE,
          search: activeSearch || undefined,
          country: country === 'all' ? undefined : country,
          province: province === 'all' ? undefined : province,
          equipment: equipment.length ? equipment : undefined,
        },
        timeoutMs: 12000,
      })
      if (requestId !== requestIdRef.current) return
      const sorted = sortLocations(data.locations || [])
      setLocations((prev) => (append ? [...prev, ...sorted] : sorted))
      setTotal(data.pagination?.total ?? sorted.length)
      setPage(targetPage)
      setProvinces(data.provinces || [])
      if (data.countries?.length) setCountries(data.countries)
    } catch (e) {
      if (requestId === requestIdRef.current) setError((e as Error)?.message || '加载失败')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    void loadLocations(1, false)
  }, [activeSearch, country, equipment, province])

  useEffect(() => {
    void loadOverview()
    void loadContributors()
  }, [])

  // 从详情或「我的点位」回来时，只有点位真的变了才刷新，否则会把翻过的页收回第一页
  const reloadAllRef = useRef(() => undefined as void)
  reloadAllRef.current = () => {
    void loadLocations(1, false)
    void loadOverview()
    void loadContributors()
  }
  useFocusEffect(useCallback(() => {
    if (consumeLocationsChanged()) reloadAllRef.current()
  }, []))

  const requireLogin = (message: string) => {
    if (isAuthenticated) return true
    Alert.alert('登录后可用', message, [
      { text: '取消', style: 'cancel' },
      { text: '去登录', onPress: () => navigation.navigate('Login') },
    ])
    return false
  }

  const openCreate = () => {
    if (!requireLogin('登录后才能新增你的单杠位置和上传图片。')) return
    setEditing(null)
    setFormVisible(true)
  }

  const openEdit = (location: StreetliftingLocation) => {
    if (!requireLogin('登录后才能编辑单杠位置和补充图片。')) return
    setEditing(location)
    setFormVisible(true)
  }

  const openMine = () => {
    if (!requireLogin('登录后可以查看和更新你上传过的单杠点位。')) return
    navigation.navigate('StreetliftingMyLocations')
  }

  const countryOptions = useMemo(() => (countries.includes('中国') ? countries : ['中国', ...countries]), [countries])
  const maxProvince = overview?.topProvinces?.[0]?.count || 1
  const maxMonth = Math.max(1, ...(overview?.recentMonths || []).map((item) => item.count))

  return (
    <Page>
      <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => navigation.goBack()} style={styles.backRow}>
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
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.totalCount ?? total}</Text><Text style={styles.statLabel}>全部点位</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.withImagesCount ?? 0}</Text><Text style={styles.statLabel}>带图片</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{overview?.provinceCount ?? provinces.length}</Text><Text style={styles.statLabel}>覆盖省份</Text></View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((item) => {
          const active = tab === item.key
          return (
            <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={() => setTab(item.key)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {tab === 'list' ? (
        <>
          <SectionCard title="筛选">
            <View style={styles.searchRow}>
              <TextInput accessibilityLabel="搜索单杠点位" value={search} onChangeText={setSearch} onSubmitEditing={() => setActiveSearch(search.trim())} returnKeyType="search" placeholder="搜索名称、城市、区县或地址，可空格分隔" placeholderTextColor={colors.textMuted} style={[styles.input, styles.flex]} />
              <Pressable accessibilityRole="button" accessibilityLabel="搜索" onPress={() => setActiveSearch(search.trim())} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>搜索</Text>
              </Pressable>
            </View>
            <FilterRow all="国家/地区" value={country} options={countryOptions} onChange={(value) => { setCountry(value); setProvince('all') }} />
            <FilterRow all="省/州" value={province} options={provinces} onChange={setProvince} />
            <EquipmentSelector filter value={equipment} onChange={setEquipment} />
            <View style={styles.mapActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="查看离我最近的单杠" accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={() => void locateNearby()} style={[styles.mapButton, styles.mapAction]}>
                <IconFont name="icon-location" color={colors.brand} size={18} />
                <Text style={styles.mapButtonText}>{locating ? '定位中…' : '附近'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="打开单杠地图" onPress={() => navigation.navigate('StreetliftingLocationsMap')} style={[styles.mapButton, styles.mapAction]}>
                <Text style={styles.mapButtonText}>地图</Text>
              </Pressable>
            </View>
          </SectionCard>

          {userPosition ? (
            <SectionCard title="离你最近" description={nearby.length ? '已获取当前位置，距离是直线距离。' : '当前筛选下没有带位置的点位。'}>
              {nearby.map((item) => (
                <NearbyLocationCard
                  key={item.id}
                  location={item}
                  onOpenDetail={() => navigation.navigate('StreetliftingLocationDetail', { id: item.id })}
                  onOpenMap={() => void openSystemMap(item)}
                />
              ))}
            </SectionCard>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {loading && !locations.length ? (
            <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载点位</Text></View>
          ) : (
            <View style={styles.list}>
              {!loading && !error && locations.length === 0 ? <Text style={styles.loadingText}>暂无匹配的单杠点位，换个筛选条件试试。</Text> : null}
              {locations.map((location) => {
                const image = getLocationImages(location)[0]
                return (
                  <View key={location.id} style={styles.locationCard}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`查看${location.name}`} onPress={() => navigation.navigate('StreetliftingLocationDetail', { id: location.id })}>
                      {image ? <Image source={{ uri: image }} style={styles.locationImage} accessibilityIgnoresInvertColors /> : <View style={styles.imageFallback}><IconFont name="icon-location" color={colors.brand} size={28} /></View>}
                      <View style={styles.locationBody}>
                        <Text style={styles.locationTitle}>{location.name}</Text>
                        <Text style={styles.locationArea}>{locationRegion(location)}</Text>
                        <EquipmentTags location={location} />
                        {location.description ? <Text style={styles.locationDesc} numberOfLines={2}>{location.description}</Text> : null}
                        {location.address ? <Text style={styles.locationMeta}>{location.address}</Text> : null}
                        <View style={styles.locationFooter}>
                          <Text style={styles.footerText}>{contributorLabel(location)} · {formatDate(location.created_at)}</Text>
                          {location.latitude != null && location.longitude != null ? <Text style={styles.mapReady}>可导航</Text> : null}
                        </View>
                      </View>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`编辑${location.name}的位置`} onPress={() => openEdit(location)} style={styles.editButton}>
                      <IconFont name="icon-pencil" color={colors.brand} size={14} />
                      <Text style={styles.editText}>编辑位置</Text>
                    </Pressable>
                  </View>
                )
              })}
              {locations.length < total ? (
                <Pressable accessibilityRole="button" accessibilityLabel="加载更多点位" accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={() => void loadLocations(page + 1, true)} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreText}>{loading ? '加载中' : '加载更多'}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </>
      ) : null}

      {tab === 'data' ? (
        overview ? (
          <>
            <View style={styles.dataGrid}>
              <DataCard label="图片覆盖率" value={formatRate(overview.withImagesCount, overview.totalCount)} helper={`${overview.withImagesCount} / ${overview.totalCount} 有图`} />
              <DataCard label="描述覆盖率" value={formatRate(overview.withDescriptionCount, overview.totalCount)} helper={`${overview.withDescriptionCount} / ${overview.totalCount} 有描述`} />
              <DataCard label="平均图片数" value={String(overview.averageImageCount)} helper="每个点位的平均图片数量" />
              <DataCard label="可地图打开" value={String(overview.mapReadyCount)} helper="已带经纬度，可直接导航" />
              <DataCard label="贡献者数" value={String(overview.contributorCount)} helper="已建立贡献累计的上传者" />
            </View>
            {overview.topProvinces?.length ? (
              <SectionCard title="省份分布 Top 6">
                <View style={styles.list}>
                  {overview.topProvinces.slice(0, 6).map((item) => (
                    <View key={item.name} style={styles.rankRow}>
                      <View style={styles.rankHead}>
                        <Text style={styles.areaName}>{item.name}</Text>
                        <Text style={styles.areaCount}>{item.count}</Text>
                      </View>
                      <View style={styles.rankTrack}>
                        <View style={[styles.rankFill, { width: `${Math.max(12, Math.round((item.count / maxProvince) * 100))}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              </SectionCard>
            ) : null}
            {overview.recentMonths?.length ? (
              <SectionCard title="最近 6 个月新增趋势">
                <View style={styles.trend}>
                  {overview.recentMonths.map((item) => (
                    <View key={item.month} style={styles.trendItem}>
                      <Text style={styles.areaCount}>{item.count}</Text>
                      <View style={styles.trendBarWrap}>
                        <View style={[styles.trendBar, { height: `${Math.max(8, Math.round((item.count / maxMonth) * 100))}%` }]} />
                      </View>
                      <Text style={styles.areaCount}>{formatMonthLabel(item.month)}</Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            ) : null}
          </>
        ) : (
          <View style={styles.loadingCard}><ActivityIndicator color={colors.brand} /><Text style={styles.loadingText}>正在加载数据</Text></View>
        )
      ) : null}

      {tab === 'rank' ? (
        <SectionCard title="单杠贡献排行榜" description="权益方向：贡献徽章、内测优先权、训练资料兑换等都会优先参考这份贡献分。">
          {loadingContributors ? <ActivityIndicator color={colors.brand} /> : null}
          {!loadingContributors && contributors.length === 0 ? <Text style={styles.loadingText}>当前可识别的署名贡献还不多，新的分享会开始累计上榜。</Text> : null}
          {contributors.map((item, index) => (
            <View key={item.contributor_key} style={styles.contributor}>
              <Text style={styles.contributorRank}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text style={styles.areaName} numberOfLines={1}>{formatContributorName(item.display_name)}</Text>
                <Text style={styles.areaCount}>{item.upload_count} 次上传 · 详细度 {item.detail_score_total} 分 · {item.image_count_total} 张图</Text>
              </View>
              <View style={styles.contributorScore}>
                <Text style={styles.contributorScoreValue}>{item.contribution_score}</Text>
                <Text style={styles.areaCount}>贡献分</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="我的点位" onPress={openMine} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>我的点位</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="分享我的单杠位置" onPress={openCreate} style={styles.primaryButton}><Text style={styles.primaryButtonText}>分享我的单杠位置</Text></Pressable>
      </View>

      <StreetliftingLocationFormModal
        visible={formVisible}
        editing={editing}
        onClose={() => setFormVisible(false)}
        onSaved={() => {
          consumeLocationsChanged()
          setFormVisible(false)
          void loadLocations(1, false)
          void loadOverview()
          void loadContributors()
        }}
      />
    </Page>
  )
}

function FilterRow({ all, value, options, onChange }: { all: string; value: string; options: string[]; onChange: (value: string) => void }) {
  if (options.length === 0) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {['all', ...options].map((item) => {
        const active = value === item
        return (
          <Pressable key={item} accessibilityRole="radio" accessibilityLabel={item === 'all' ? `全部${all}` : item} accessibilityState={{ checked: active }} onPress={() => onChange(item)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item === 'all' ? `全部${all}` : item}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function DataCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <View style={styles.dataCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.areaCount}>{helper}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backRow: { alignSelf: 'flex-start', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hero: { minHeight: 152, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderRadius: radius.xl, padding: spacing.md, backgroundColor: '#1F1F1F' },
  heroText: { flex: 1, gap: spacing.xs },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  heroSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },
  heroIcon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  statGrid: { flexDirection: 'row', gap: spacing.xs },
  statCard: { flex: 1, borderRadius: radius.lg, padding: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  tabBar: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  input: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm, color: colors.text, fontSize: 14, backgroundColor: colors.surfaceMuted },
  searchButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  filterRow: { gap: spacing.xs },
  // 与小程序 ClChip 一致
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.selected },
  chipText: { color: colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: colors.selectedText, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: spacing.xs },
  mapActions: { flexDirection: 'row', gap: spacing.xs },
  mapAction: { flex: 1 },
  mapButton: { minHeight: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.brandSoft },
  mapButtonText: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  primaryButton: { flex: 2, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  loadingCard: { minHeight: 96, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface },
  loadingText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  areaName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  areaCount: { color: colors.textTertiary, fontSize: 12, fontWeight: '600' },
  list: { gap: spacing.sm },
  locationCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  locationImage: { width: '100%', height: 160 },
  imageFallback: { height: 144, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  locationBody: { padding: spacing.sm, gap: spacing.xs },
  locationTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  locationArea: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  locationDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  locationMeta: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  locationFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  footerText: { flex: 1, color: colors.textTertiary, fontSize: 12 },
  mapReady: { color: colors.success, fontSize: 12, fontWeight: '700' },
  editButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  editText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  loadMoreButton: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  loadMoreText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  dataGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dataCard: { width: '48%', flexGrow: 1, gap: 2, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rankRow: { gap: 4 },
  rankHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  rankFill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  trend: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  trendItem: { flex: 1, alignItems: 'center', gap: 4 },
  trendBarWrap: { width: '100%', height: 96, justifyContent: 'flex-end', alignItems: 'center' },
  trendBar: { width: 16, borderRadius: radius.sm, backgroundColor: colors.brand },
  contributor: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  contributorRank: { width: 28, textAlign: 'center', color: colors.brand, fontSize: 15, fontWeight: '700' },
  contributorScore: { alignItems: 'flex-end' },
  contributorScoreValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
})
