/**
 * 单杠位置 - 小程序原生实现（列表、筛选、新增/编辑、图片上传）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea, Picker, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import {
  streetliftingIndexService,
  type StreetliftingLocationContributor,
  type StreetliftingLocationOverviewStats,
  type StreetliftingLocation,
  type StreetliftingLocationMapPin
} from '@/services/streetliftingIndexService'
import { authService } from '@/services/authService'
import {
  buildSharePath,
  buildStreetliftingLocationShareImageUrl,
  buildStreetliftingLocationSharePath,
  createSharePayload,
  createTimelinePayload,
  getMiniappEnvVersion,
  getStreetliftingLocationShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import { API_BASE_URL } from '@/utils/request'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useSharePoster } from '@/hooks/useSharePoster'
import { SharePosterModal } from '@/components/SharePosterModal'
import {
  drawStreetliftingLocationPoster,
  type StreetliftingLocationPosterData
} from './poster'
import { useTheme } from '@/hooks/useTheme'
import { isValidLocationCoordinates, getLocationCountry, toWeChatCoordinates, inferLocationEquipment, normalizeLocationEquipment, resolveLocationEquipment, matchesLocationEquipment, type LocationEquipmentType, type LocationCoordinateSystem, type LocationSelection } from '@coachlink/core'
import { EquipmentSelector, EquipmentTags } from '@/components/LocationEquipment'
import { readLocationCache, writeLocationCache, type LocationDraft, type LocationListCache } from '@/utils/streetliftingLocationCache'
import { getApproxUserLocation } from '@/utils/approxLocation'
import { parseNativeLocation, mergePickedLocation, usableSearchSelection, getPickerStart, type PickerAutoFields } from '@/utils/locationPicker'

const MAX_IMAGES = 4
const PAGE_SIZE = 20
const COUNTRY_OPTIONS = ['中国', '日本', '韩国', '新加坡', '马来西亚', '泰国', '印度尼西亚', '菲律宾', '越南', '印度', '阿联酋', '美国', '加拿大', '墨西哥', '巴西', '英国', '法国', '德国', '西班牙', '意大利', '荷兰', '瑞士', '瑞典', '挪威', '俄罗斯', '土耳其', '澳大利亚', '新西兰', '南非', '其他（自行填写）']

type UserLocation = {
  latitude: number
  longitude: number
}

function requestPickerNearby(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('附近定位超时')), 8000)
    void getApproxUserLocation().then(
      position => { clearTimeout(timer); resolve(position) },
      error => { clearTimeout(timer); reject(error) }
    )
  })
}

type NearbyLocation = StreetliftingLocationMapPin & {
  distanceKm: number
}

function getLocationImages(loc: StreetliftingLocation): string[] {
  if (loc.image_urls?.length) return loc.image_urls
  if (loc.image_url) return [loc.image_url]
  return []
}

function NearbyLocationCard({ location, onOpenMap, onPreview }: {
  location: NearbyLocation
  onOpenMap: (location: NearbyLocation) => void
  onPreview: (location: StreetliftingLocation) => Promise<void>
}) {
  const cacheKey = `detail:${location.id}`
  const [details, setDetails] = useState<StreetliftingLocation | null>(() => readLocationCache(cacheKey))
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const cached = readLocationCache<StreetliftingLocation>(cacheKey)
    if (cached) setDetails(cached)
    setLoadingDetails(true)
    setLoadFailed(false)
    void (async () => {
      try {
        const result = await streetliftingIndexService.getLocation(location.id)
        writeLocationCache(cacheKey, result)
        if (!cancelled) setDetails(result)
      } catch {
        if (!cancelled) setLoadFailed(true)
      } finally {
        if (!cancelled) setLoadingDetails(false)
      }
    })()
    return () => { cancelled = true }
  }, [cacheKey, location.id, retry])

  const images = details ? getLocationImages(details) : []
  return (
    <View className='nearby-item'>
      <View className='nearby-item-header'>
        <View className='nearby-item-main'>
          <Text className='nearby-name'>{location.name}</Text>
          <Text className='nearby-distance'>{location.distanceKm < 1 ? `${Math.round(location.distanceKm * 1000)}m` : `${location.distanceKm.toFixed(1)}km`}</Text>
        </View>
        <View className='nearby-map-btn' onClick={() => onOpenMap(location)}>
          <Text className='iconfont icon-location' />
          <Text>地图查看</Text>
        </View>
      </View>
      <EquipmentTags location={details || location} />
      {details && images.length > 0 ? (
        <View className='nearby-photo-wrap' onClick={() => void onPreview(details)}>
          <Image className='nearby-photo' src={images[0]} mode='aspectFill' />
          <View className='nearby-photo-badge'>
            <Text>{images.length} 张图 · 点击查看</Text>
          </View>
        </View>
      ) : loadingDetails ? (
        <Text className='nearby-photo-status'>照片加载中…</Text>
      ) : loadFailed ? (
        <View className='nearby-photo-retry' onClick={() => setRetry(value => value + 1)}>
          <Text>照片加载失败，点击重试</Text>
        </View>
      ) : (
        <Text className='nearby-photo-status'>暂未上传现场照片</Text>
      )}
    </View>
  )
}

function hasLocationImages(loc: StreetliftingLocation): boolean {
  return getLocationImages(loc).length > 0
}

function getLocationTimestamp(loc: StreetliftingLocation): number {
  const ts = new Date(loc.created_at).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function sortLocations(locations: StreetliftingLocation[]): StreetliftingLocation[] {
  return [...locations].sort((a, b) => {
    const imageDiff = Number(hasLocationImages(b)) - Number(hasLocationImages(a))
    if (imageDiff !== 0) return imageDiff

    const imageCountDiff = getLocationImages(b).length - getLocationImages(a).length
    if (imageCountDiff !== 0) return imageCountDiff

    return getLocationTimestamp(b) - getLocationTimestamp(a)
  })
}

function maskPhone(value: string): string {
  return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function maskEmail(value: string): string {
  const [name, domain] = value.split('@')
  if (!name || !domain) return value
  if (name.length <= 2) return `${name[0] || '*'}*@${domain}`
  return `${name.slice(0, 2)}***@${domain}`
}

function formatContributorName(value?: string | null): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return '未署名贡献者'
  if (/^1\d{10}$/.test(trimmed)) return maskPhone(trimmed)
  if (trimmed.includes('@')) return maskEmail(trimmed)
  return trimmed
}

function getCurrentContributorContact(): string | null {
  const user = authService.getCurrentUser()
  if (!user) return null
  return user.nickname || user.name || user.phone || user.phoneOrEmail || null
}

function requireLoginForLocationsAction(content: string) {
  Taro.showModal({
    title: '登录后可用',
    content,
    confirmText: '去登录',
    success: (res) => {
      if (res.confirm) {
        Taro.navigateTo({ url: authService.buildLoginUrl('/streetlifting/index/locations') })
      }
    }
  })
}

function getContributorLabel(loc: StreetliftingLocation): string {
  return formatContributorName(loc.contributor_name_snapshot || loc.user_contact)
}

function formatRate(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function formatMonthLabel(month: string): string {
  const parts = month.split('-')
  const monthNum = Number(parts[1] || 0)
  return monthNum > 0 ? `${monthNum}月` : month
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

function calculateDistanceKm(from: UserLocation, to: UserLocation): number {
  const earthRadiusKm = 6371
  const latDelta = toRadians(to.latitude - from.latitude)
  const lngDelta = toRadians(to.longitude - from.longitude)
  const fromLat = toRadians(from.latitude)
  const toLat = toRadians(to.latitude)

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function getLocationPreviewImage(loc?: Partial<StreetliftingLocation> | null): string {
  const list = Array.isArray(loc?.image_urls) ? loc?.image_urls : []
  return String(list?.[0] || loc?.image_url || '').trim()
}

function buildLocationSharePath(loc?: Partial<StreetliftingLocation> | null) {
  const locationId = String(loc?.id || '').trim()
  if (!locationId) {
    return buildStreetliftingLocationSharePath()
  }
  return buildSharePath('/streetlifting/index/location-share', { locationId })
}

function buildSharedLocationPreviewFromParams(params: Record<string, unknown>): StreetliftingLocation | null {
  const locationId = String(params.locationId || '').trim()
  const name = String(params.sn || '').trim()
  const province = String(params.sp || '').trim()
  const city = String(params.sc || '').trim()
  const county = String(params.sct || '').trim()
  const address = String(params.sa || '').trim()
  const description = String(params.sd || '').trim()

  if (!locationId && !name) return null
  /* 新分享链接只带 locationId，没有预览参数；此时返回 null，让页面走 loading → API 拉取真实数据 */
  if (locationId && !name) return null

  return {
    id: locationId || `shared-${name || 'location'}`,
    name: name || '分享的单杠点位',
    description: description || null,
    address: address || null,
    city: city || null,
    province: province || null,
    county: county || null,
    image_url: null,
    image_urls: [],
    latitude: null,
    longitude: null,
    created_at: '',
    user_contact: null,
    contributor_user_id: null,
    contributor_name_snapshot: null
  }
}

function isLocationPermissionError(error: unknown): boolean {
  const message = String((error as Error)?.message || (error as any)?.errMsg || '').toLowerCase()
  return [
    'auth deny',
    'authorize',
    'permission',
    'scope.userlocation',
    'userlocation',
    'denied',
    '未授权',
    '权限'
  ].some((keyword) => message.includes(keyword))
}

export default function StreetliftingLocations() {
  const { effectiveTheme } = useTheme()
  const routerParams = (Taro.getCurrentInstance().router?.params || {}) as Record<string, unknown>
  const sharedLocationId = String(routerParams.locationId || '').trim()
  const sharedLocationPreview = useMemo(() => buildSharedLocationPreviewFromParams(routerParams), [])
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<StreetliftingLocation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [provinces, setProvinces] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('all')
  const [country, setCountry] = useState('all')
  const [equipmentFilter, setEquipmentFilter] = useState<LocationEquipmentType[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<LocationEquipmentType[]>([])
  const equipmentTouchedRef = useRef(false)
  const mapPinsRequestRef = useRef(0)
  const [countries, setCountries] = useState<string[]>(['中国'])
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locating, setLocating] = useState(false)
  const [mapPins, setMapPins] = useState<StreetliftingLocationMapPin[]>([])
  const [loadingMapPins, setLoadingMapPins] = useState(false)
  const [loadingOverview, setLoadingOverview] = useState(true)
  const [locationOverview, setLocationOverview] = useState<StreetliftingLocationOverviewStats | null>(null)
  const [loadingContributors, setLoadingContributors] = useState(false)
  const [contributors, setContributors] = useState<StreetliftingLocationContributor[]>([])
  const [analysisSheetOpen, setAnalysisSheetOpen] = useState(false)
  const [leaderboardSheetOpen, setLeaderboardSheetOpen] = useState(false)
  const [rightsSheetOpen, setRightsSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [sharedLocationLoading, setSharedLocationLoading] = useState(false)
  const [sharedLocation, setSharedLocation] = useState<StreetliftingLocation | null>(sharedLocationPreview)
  const [shareSheetLocation, setShareSheetLocation] = useState<StreetliftingLocation | null>(null)
  const [showPosterModal, setShowPosterModal] = useState(false)
  const requestIdRef = useRef(0)
  const shareTargetLocationRef = useRef<StreetliftingLocation | null>(sharedLocationPreview)
  const firstFilterEffectRef = useRef(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StreetliftingLocation | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    province: '',
    county: '',
    country: '中国',
    coordinate_system: null as LocationCoordinateSystem | null,
    latitude: null as number | null,
    longitude: null as number | null
  })
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [overseasLocation, setOverseasLocation] = useState(false)
  const [manualDetailsOpen, setManualDetailsOpen] = useState(false)
  const [regionDetailsOpen, setRegionDetailsOpen] = useState(false)
  const [openingPicker, setOpeningPicker] = useState(false)
  const autoFilledRef = useRef<PickerAutoFields>({})
  useEffect(() => {
    if (dialogOpen && !equipmentTouchedRef.current) setEquipmentTypes(inferLocationEquipment(form))
  }, [dialogOpen, form.name, form.description])
  const pickerRequestRef = useRef<{ key: string; userId: string; form: typeof form; id: string | null; imageUrls: string[] } | null>(null)
  const hasSelectedPosition = isValidLocationCoordinates(form.latitude, form.longitude)
  const countryOptions = useMemo(() => Array.from(new Set(['中国', ...countries])), [countries])

  useDidShow(() => {
    const returnedFilters = readLocationCache<{ equipment: LocationEquipmentType[]; country?: string; province?: string; search?: string }>('map-equipment-filter-return')
    if (returnedFilters) {
      writeLocationCache('map-equipment-filter-return', null)
      setEquipmentFilter(normalizeLocationEquipment(returnedFilters.equipment))
      setCountry(returnedFilters.country || 'all')
      setProvince(returnedFilters.province || 'all')
      setSearch(returnedFilters.search || '')
    }
    const request = pickerRequestRef.current
    if (!request) return
    pickerRequestRef.current = null
    const result = readLocationCache<{ userId: string; position: LocationSelection }>(request.key)
    writeLocationCache(request.key, null)
    setOpeningPicker(false)
    setDialogOpen(true)
    if (result?.userId !== request.userId || authService.getCurrentUser()?.id !== request.userId || !isValidLocationCoordinates(result?.position?.latitude, result?.position?.longitude)) return
    const position = result.position
    const merged = mergePickedLocation(request.form, usableSearchSelection(position), autoFilledRef.current)
    const next = merged.form
    autoFilledRef.current = merged.autoFilled
    writeLocationCache(`draft:${request.userId}`, { ...next, id: request.id, image_urls: request.imageUrls, equipment_types: equipmentTypes, equipment_touched: equipmentTouchedRef.current, auto_filled: merged.autoFilled })
    setForm(next)
    setManualDetailsOpen(true)
    void Taro.showToast({ title: next.address ? '位置和地址已带回，请核对' : '位置已记录，请补充地址', icon: 'none' })
  })
  useEffect(() => {
    const userId = authService.getCurrentUser()?.id
    if (dialogOpen && userId) writeLocationCache(`draft:${userId}`, { ...form, id: editing?.id || null, image_urls: imageUrls, equipment_types: equipmentTypes, equipment_touched: equipmentTouchedRef.current, auto_filled: autoFilledRef.current })
  }, [dialogOpen, form, editing, imageUrls, equipmentTypes])
  const posterLoadResultRef = useRef<{ coverLoaded: boolean; qrLoaded: boolean }>({ coverLoaded: false, qrLoaded: false })

  const {
    generate: generatePoster,
    generating: posterGenerating,
    imageUrl: posterImageUrl,
    reset: resetPoster
  } = useSharePoster<StreetliftingLocationPosterData>({
    canvasId: 'streetlifting-location-poster-canvas',
    width: 750,
    draw: (ctx, posterData) => drawStreetliftingLocationPoster(ctx, posterData),
    onDrawResult: (result) => {
      if (result && typeof result === 'object') {
        posterLoadResultRef.current = result as { coverLoaded: boolean; qrLoaded: boolean }
      }
    }
  })

  const loadOverview = async () => {
    setLoadingOverview(true)
    try {
      const data = await streetliftingIndexService.getStats()
      setLocationOverview(data.locationOverview)
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '统计加载失败', icon: 'none' })
    } finally {
      setLoadingOverview(false)
    }
  }

  const fetchLocations = async (targetPage = 1, append = false) => {
    const currentRequestId = ++requestIdRef.current
    const params = { page: targetPage, limit: PAGE_SIZE, search: search.trim() || undefined, country: country === 'all' ? undefined : country, province: province === 'all' ? undefined : province, equipment: normalizeLocationEquipment(equipmentFilter) }
    const cacheKey = `list:${JSON.stringify(params)}`
    if (!append) {
      const cached = readLocationCache<LocationListCache>(cacheKey)
      if (cached && Array.isArray(cached.locations) && cached.pagination) {
        setLocations(sortLocations(cached.locations))
        setTotal(cached.pagination.total)
        setPage(targetPage)
        setCountries(cached.countries || [])
      }
    }
    setLoading(true)
    try {
      const data = await streetliftingIndexService.listLocations(params)

      if (currentRequestId !== requestIdRef.current) return
      writeLocationCache(cacheKey, data)

      const nextLocations = sortLocations(data?.locations || [])
      setLocations((prev) => (append ? [...prev, ...nextLocations] : nextLocations))
      setTotal(data?.pagination?.total ?? nextLocations.length)
      setPage(targetPage)
      setProvinces(data?.provinces || [])
      setCountries(data?.countries || [])
    } catch (e) {
      if (currentRequestId === requestIdRef.current) {
        Taro.showToast({ title: (e as Error)?.message || '加载失败', icon: 'none' })
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  const loadContributorLeaderboard = async () => {
    if (loadingContributors) return
    setLoadingContributors(true)
    try {
      const data = await streetliftingIndexService.listLocationContributors({ limit: 10 })
      setContributors(data?.contributors || [])
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '贡献榜加载失败', icon: 'none' })
    } finally {
      setLoadingContributors(false)
    }
  }

  useEffect(() => {
    void fetchLocations(1, false)
    void loadOverview()
    void loadContributorLeaderboard()
  }, [])

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    if (!sharedLocationId) {
      setSharedLocation(null)
      return
    }

    setActiveTab(0)
    setSharedLocationLoading(true)

    void streetliftingIndexService
      .getLocation(sharedLocationId)
      .then((location) => {
        setSharedLocation(location)
      })
      .catch((error) => {
        console.error('[streetlifting-locations] load shared location failed', error)
        setSharedLocation(null)
      })
      .finally(() => {
        setSharedLocationLoading(false)
      })
  }, [sharedLocationId])

  useEffect(() => {
    if (firstFilterEffectRef.current) {
      firstFilterEffectRef.current = false
      return
    }
    const t = setTimeout(() => {
      fetchLocations(1, false)
      if (userLocation) void ensureMapPins().catch(error => Taro.showToast({ title: error.message || '附近点位加载失败', icon: 'none' }))
    }, 300)
    return () => clearTimeout(t)
  }, [search, province, country, equipmentFilter])

  const resetForm = () => {
    setEditing(null)
    setForm({ name: '', description: '', address: '', city: '', province: '', county: '', country: '中国', coordinate_system: null, latitude: null, longitude: null })
    setOverseasLocation(false)
    setManualDetailsOpen(false)
    setRegionDetailsOpen(false)
    autoFilledRef.current = {}
    equipmentTouchedRef.current = false
    setEquipmentTypes([])
    setImageUrls([])
  }

  const openCreate = () => {
    if (!authService.isAuthenticated()) {
      requireLoginForLocationsAction('登录后才能新增你的单杠位置和上传图片。')
      return
    }
    resetForm()
    const draft = readLocationCache<LocationDraft>(`draft:${authService.getCurrentUser()?.id || ''}`)
    if (draft && draft.id === null && typeof draft.name === 'string') {
      setForm({ name: draft.name, description: draft.description, address: draft.address, city: draft.city, province: draft.province, county: draft.county, country: draft.country || '中国', latitude: draft.latitude, longitude: draft.longitude, coordinate_system: draft.coordinate_system })
      setImageUrls(draft.image_urls || [])
      equipmentTouchedRef.current = draft.equipment_touched ?? false
      setEquipmentTypes(Array.isArray(draft.equipment_types) ? normalizeLocationEquipment(draft.equipment_types) : inferLocationEquipment(draft))
      setOverseasLocation(Boolean(draft.country && draft.country !== '中国'))
      autoFilledRef.current = draft.auto_filled || {}
      setManualDetailsOpen(Boolean(draft.name || draft.address || isValidLocationCoordinates(draft.latitude, draft.longitude)))
    }
    setDialogOpen(true)
  }

  const openEdit = (loc: StreetliftingLocation) => {
    if (!authService.isAuthenticated()) {
      requireLoginForLocationsAction('登录后才能编辑单杠位置和补充图片。')
      return
    }
    const imgs = getLocationImages(loc)
    const pending = readLocationCache<LocationDraft>(`draft:${authService.getCurrentUser()?.id || ''}`)
    const source = pending?.id === loc.id ? { ...loc, ...pending } : loc
    equipmentTouchedRef.current = pending?.id === loc.id ? pending.equipment_touched ?? false : resolveLocationEquipment(loc).equipment_source === 'confirmed'
    setEquipmentTypes(resolveLocationEquipment(source).equipment_types)
    setEditing(loc)
    setForm({
      name: source.name,
      description: source.description || '',
      address: source.address || '',
      city: source.city || '',
      province: source.province || '',
      county: source.county || '',
      country: getLocationCountry(source),
      coordinate_system: source.coordinate_system || null,
      latitude: source.latitude ?? null,
      longitude: source.longitude ?? null
    })
    setImageUrls(pending?.id === loc.id ? pending.image_urls : imgs)
    setOverseasLocation(getLocationCountry(source) !== '中国')
    autoFilledRef.current = pending?.id === loc.id ? pending.auto_filled || {} : {}
    setManualDetailsOpen(true)
    setRegionDetailsOpen(false)
    setDialogOpen(true)
  }

  const openMapPicker = async (previousNearby?: UserLocation | null) => {
    if (openingPicker) return
    const userId = authService.getCurrentUser()?.id || ''
    if (!userId) { requireLoginForLocationsAction('登录后可选择并分享单杠位置。'); return }
    setOpeningPicker(true)
    const key = `picker:${userId}:${Date.now()}`
    pickerRequestRef.current = { key, userId, form, id: editing?.id || null, imageUrls }
    writeLocationCache(`draft:${userId}`, { ...form, id: editing?.id || null, image_urls: imageUrls, equipment_types: equipmentTypes, equipment_touched: equipmentTouchedRef.current, auto_filled: autoFilledRef.current })
    // New locations start at a fresh, explicitly requested nearby position.
    let nearby = previousNearby || null
    if (!hasSelectedPosition && previousNearby === undefined) {
      try { nearby = await requestPickerNearby() } catch { /* The map shows the locate action and search fallback. */ }
    }
    if (authService.getCurrentUser()?.id !== userId) { pickerRequestRef.current = null; setOpeningPicker(false); return }
    writeLocationCache(key, { userId, initial: { ...form, id: editing?.id || null, image_urls: imageUrls }, nearby })
    if (!readLocationCache(key)) { pickerRequestRef.current = null; setOpeningPicker(false); Taro.showToast({ title: '暂时无法保存选点草稿，请重试', icon: 'none' }); return }
    const params = ['mode=pick', `selectionKey=${encodeURIComponent(key)}`]
    // Unmount the modal before navigating: native scroll/input overlays must not
    // cover the new page. Return via useDidShow and a scoped local result.
    setDialogOpen(false)
    try {
      await Taro.navigateTo({ url: `/streetlifting/index/locations-map?${params.join('&')}` })
    } catch {
      pickerRequestRef.current = null
      writeLocationCache(key, null)
      setDialogOpen(true)
      void Taro.showToast({ title: '地图打开失败，请重试', icon: 'none' })
    } finally { setOpeningPicker(false) }
  }

  const changeLocationCountry = (country: string) => {
    setForm(previous => country === previous.country ? previous : { ...previous, country, latitude: null, longitude: null, coordinate_system: null })
    if (country === '中国') setOverseasLocation(false)
  }

  const chooseLocation = async () => {
    if (openingPicker) return
    if (!form.country.trim()) { void Taro.showToast({ title: '请先填写地点所在国家 / 地区', icon: 'none' }); return }
    if (form.country !== '中国') { await openMapPicker(); return }
    const userId = authService.getCurrentUser()?.id
    if (!userId) { requireLoginForLocationsAction('登录后可选择并分享单杠位置。'); return }
    writeLocationCache(`draft:${userId}`, { ...form, id: editing?.id || null, image_urls: imageUrls, equipment_types: equipmentTypes, equipment_touched: equipmentTouchedRef.current, auto_filled: autoFilledRef.current })
    setOpeningPicker(true)
    let nearby: UserLocation | null = null
    try {
      if (!hasSelectedPosition) {
        try {
          nearby = await requestPickerNearby()
          writeLocationCache(`last-user-location:${userId}`, { ...nearby, locatedAt: Date.now() })
        } catch {
          const answer = await Taro.showModal({ title: '暂时无法定位到你附近', content: '可以继续打开地图搜索地点，也可以取消后重试定位。', confirmText: '搜索地点', cancelText: '取消' })
          if (!answer.confirm) return
        }
      }
      if (authService.getCurrentUser()?.id !== userId) return
      const initial = getPickerStart(hasSelectedPosition ? form : null, nearby)
      // Local DevTools diagnosis: retain the real callback and Promise payloads
      // separately. Production builds do not record this trace.
      const nativeTrace: Record<string, unknown> = { startedAt: Date.now(), initial }
      const traceNative = (stage: 'callback' | 'promise' | 'fail', payload: unknown) => {
        if (process.env.NODE_ENV !== 'development') return
        const response = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
        nativeTrace[stage] = { keys: Object.keys(response), name: response.name, address: response.address, latitude: response.latitude, longitude: response.longitude, errMsg: response.errMsg }
        writeLocationCache(`native-picker-diagnostic:${userId}`, nativeTrace)
      }
      if (process.env.NODE_ENV === 'development') writeLocationCache(`native-picker-diagnostic:${userId}`, nativeTrace)
      const result = await Taro.chooseLocation({
        ...(initial ? { latitude: initial.latitude, longitude: initial.longitude } : {}),
        success: response => traceNative('callback', response),
        fail: error => traceNative('fail', error)
      })
      traceNative('promise', result)
      if (!isValidLocationCoordinates(result.latitude, result.longitude)) throw new Error('无效地图位置')
      // DevTools can report success with no POI text and the unchanged opening
      // position. Keep the draft, but do not accept it as a new selection.
      if (initial && !result.name?.trim() && !result.address?.trim()
        && Math.abs(result.latitude - initial.latitude) < 0.000001
        && Math.abs(result.longitude - initial.longitude) < 0.000001) {
        throw new Error('未返回所选地点')
      }
      if (authService.getCurrentUser()?.id !== userId) return
      const merged = mergePickedLocation(form, parseNativeLocation(result), autoFilledRef.current)
      autoFilledRef.current = merged.autoFilled
      setForm(merged.form)
      setManualDetailsOpen(true)
      void Taro.showToast({ title: merged.form.address ? '位置和地址已带回，请核对' : '位置已记录，请补充地址', icon: 'none' })
    } catch (error) {
      const message = String((error as { errMsg?: string; message?: string })?.errMsg || (error as Error)?.message || '')
      if (!/cancel/i.test(message) && authService.getCurrentUser()?.id === userId) {
        await Taro.showModal({
          title: message === '未返回所选地点' ? '没有收到所选地点' : '微信选点暂不可用',
          content: '可以继续在地图上搜索或标记位置。能获取的名称和地址会自动带回；缺少或不准确的信息请修改补充。',
          showCancel: false,
          confirmText: '继续选点'
        })
        await openMapPicker(nearby)
      }
    } finally { setOpeningPicker(false) }
  }

  const removeImage = (index: number) => {
    setImageUrls((p) => p.filter((_, i) => i !== index))
  }

  const previewLocationImages = async (location: StreetliftingLocation) => {
    const urls = getLocationImages(location)
    if (!urls.length) return
    try {
      await Taro.previewImage({ current: urls[0], urls })
    } catch (error) {
      console.error('[streetlifting-locations] preview images failed', error)
      void Taro.showToast({ title: '图片暂时无法打开，请重试', icon: 'none' })
    }
  }

  const chooseImage = async () => {
    if (imageUrls.length >= MAX_IMAGES) {
      Taro.showToast({ title: `最多${MAX_IMAGES}张`, icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({
        count: MAX_IMAGES - imageUrls.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      setUploading(true)
      for (const path of res.tempFilePaths) {
        const up = await streetliftingIndexService.uploadLocationImage(path)
        if (up?.url) setImageUrls((p) => [...p, up.url])
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请填写地点名称', icon: 'none' })
      return
    }
    if (!form.country.trim()) {
      Taro.showToast({ title: '请填写国家/地区', icon: 'none' })
      return
    }
    const coordinateFields = hasSelectedPosition
      ? { latitude: form.latitude, longitude: form.longitude, coordinate_system: form.coordinate_system }
      : { latitude: null, longitude: null, coordinate_system: null }
    const equipmentFields = { equipment_types: equipmentTypes.length || equipmentTouchedRef.current ? equipmentTypes : undefined }
    const draftKey = `draft:${authService.getCurrentUser()?.id || ''}`
    // Persist the mutation before starting cloud sync; failed submissions keep a recoverable draft.
    writeLocationCache(draftKey, { ...form, ...coordinateFields, id: editing?.id || null, image_urls: imageUrls, equipment_types: equipmentTypes, equipment_touched: equipmentTouchedRef.current, auto_filled: autoFilledRef.current })
    setSubmitting(true)
    try {
      if (editing) {
        await streetliftingIndexService.updateLocation({
          id: editing.id,
          ...equipmentFields,
          name: form.name.trim(),
          country: form.country.trim(),
          ...coordinateFields,
          description: form.description || null,
          address: form.address || null,
          city: form.city || null,
          province: form.province || null,
          county: form.county || null,
          image_urls: imageUrls.length ? imageUrls : null
        })
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        await streetliftingIndexService.createLocation({
          ...equipmentFields,
          name: form.name.trim(),
          country: form.country.trim(),
          ...coordinateFields,
          description: form.description || null,
          address: form.address || null,
          city: form.city || null,
          province: form.province || null,
          county: form.county || null,
          image_urls: imageUrls.length ? imageUrls : null,
          user_contact: getCurrentContributorContact()
        })
        Taro.showToast({ title: '提交成功', icon: 'success' })
      }
      setDialogOpen(false)
      writeLocationCache(draftKey, null)
      resetForm()
      void fetchLocations(page, false)
      void loadOverview()
      void loadContributorLeaderboard()
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '操作失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const createLocationSharePayload = (loc?: Partial<StreetliftingLocation> | null) => {
    if (!loc?.id) {
      return createSharePayload({
        title: getStreetliftingLocationShareTitle(),
        path: buildStreetliftingLocationSharePath()
      })
    }

    const areaName = [loc.country, loc.city, loc.province].filter(Boolean).join(' ')
    const posterArea = [loc.country, loc.province, loc.city, loc.county, loc.address].filter(Boolean).join(' ')
    return createSharePayload({
      title: getStreetliftingLocationShareTitle(loc.name, areaName),
      path: buildLocationSharePath(loc),
      imageUrl: buildStreetliftingLocationShareImageUrl({
        id: loc.id,
        name: loc.name,
        area: posterArea || areaName,
        description: loc.description,
        imageUrl: getLocationPreviewImage(loc)
      })
    })
  }

  const sharePayload = useMemo(() => createLocationSharePayload(sharedLocation), [sharedLocation])

  useShareAppMessage((res: any) => {
    if (res?.from === 'button' && shareTargetLocationRef.current) {
      return createLocationSharePayload(shareTargetLocationRef.current)
    }
    return sharePayload
  })

  useShareTimeline(() => createTimelinePayload(sharePayload))

  const handleOpenShareOptions = useCallback((loc: StreetliftingLocation) => {
    shareTargetLocationRef.current = loc
    setShareSheetLocation(loc)
  }, [])

  const handleCloseShareSheet = useCallback(() => {
    setShareSheetLocation(null)
  }, [])

  const handlePrepareLinkShare = useCallback(() => {
    if (shareSheetLocation) {
      shareTargetLocationRef.current = shareSheetLocation
    }
  }, [shareSheetLocation])

  const buildPosterData = useCallback((loc: StreetliftingLocation): StreetliftingLocationPosterData => {
    const area = [loc.country, loc.province, loc.city, loc.county, loc.address].filter(Boolean).join(' ')
    return {
      name: loc.name,
      area: area || '打开 CoachLink 查看这个单杠点位',
      description: String(loc.description || '查看地址、环境描述和现场图片').trim(),
      imageUrl: getLocationImages(loc)[0] || undefined,
      qrCodeUrl: `${API_BASE_URL}/api/miniapp/qrcode/streetlifting-location?locationId=${encodeURIComponent(loc.id)}&envVersion=${getMiniappEnvVersion()}`
    }
  }, [])

  const handleOpenPoster = useCallback(async () => {
    if (!shareSheetLocation) return
    shareTargetLocationRef.current = shareSheetLocation
    setShareSheetLocation(null)
    setShowPosterModal(true)
    posterLoadResultRef.current = { coverLoaded: false, qrLoaded: false }
    await new Promise<void>((resolve) => Taro.nextTick(() => resolve()))
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 40))

    /* 清理历史临时文件，避免小程序 100MB 存储上限导致连环失败 */
    try {
      const fs = Taro.getFileSystemManager()
      const userDataPath = (Taro as any).env?.USER_DATA_PATH
      if (userDataPath) {
        try {
          const files = fs.readdirSync(userDataPath)
          for (const file of files) {
            if (file.startsWith('cv_') || file.startsWith('tmp_')) {
              try { fs.unlinkSync(`${userDataPath}/${file}`) } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    const posterData = buildPosterData(shareSheetLocation)
    const token = Taro.getStorageSync('token') || ''
    const diagnostics: string[] = []

    /* 二维码：Taro.request 带 token 获取 base64，绕过 downloadFile 401 限制 */
    if (posterData.qrCodeUrl) {
      try {
        const qrRes = await Taro.request({
          url: `${posterData.qrCodeUrl}&format=base64`,
          method: 'GET',
          header: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (qrRes.data?.success && qrRes.data?.data?.base64) {
          posterData.qrCodeUrl = qrRes.data.data.base64
        } else if (qrRes.data?.success === false) {
          diagnostics.push(`二维码接口错误：${qrRes.data?.message || JSON.stringify(qrRes.data)}`)
        }
      } catch (e: any) {
        diagnostics.push(`二维码获取异常：${e?.errMsg || String(e)}`)
      }
    }

    /* 图片：Taro.request 带 token 获取二进制并写入本地，绕过 downloadFile 限制 */
    if (posterData.imageUrl) {
      try {
        const imgRes = await Taro.request({
          url: posterData.imageUrl,
          method: 'GET',
          responseType: 'arraybuffer',
          header: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (imgRes.statusCode === 200 && imgRes.data) {
          const fs = Taro.getFileSystemManager()
          const userDataPath = (Taro as any).env?.USER_DATA_PATH
          if (userDataPath) {
            const ext = posterData.imageUrl.split('.').pop()?.split('?')[0] || 'jpg'
            const tmpPath = `${userDataPath}/cv_img_${Date.now()}.${ext}`
            try {
              fs.writeFileSync(tmpPath, imgRes.data as ArrayBuffer, 'binary')
              posterData.imageUrl = tmpPath
            } catch (writeErr: any) {
              console.warn('[poster] writeFile failed, trying downloadFile fallback', writeErr)
              const dl = await Taro.downloadFile({ url: posterData.imageUrl })
              if (dl.statusCode === 200 && dl.tempFilePath) {
                posterData.imageUrl = dl.tempFilePath
              } else {
                diagnostics.push(`现场图片写入失败且 downloadFile 也失败：HTTP ${dl.statusCode}`)
              }
            }
          }
        } else {
          diagnostics.push(`现场图片获取失败：HTTP ${imgRes.statusCode}`)
        }
      } catch (e: any) {
        diagnostics.push(`现场图片获取异常：${e?.errMsg || String(e)}`)
      }
    }

    await generatePoster(posterData)

    const { coverLoaded, qrLoaded } = posterLoadResultRef.current
    const hasImage = Boolean(buildPosterData(shareSheetLocation).imageUrl)
    const hasQr = Boolean(buildPosterData(shareSheetLocation).qrCodeUrl)
    const missing: string[] = []
    if (hasImage && !coverLoaded) missing.push('现场图片')
    if (hasQr && !qrLoaded) missing.push('小程序二维码')

    if (diagnostics.length > 0 || missing.length > 0) {
      setTimeout(() => {
        Taro.showModal({
          title: '海报生成诊断',
          content: [
            ...diagnostics,
            ...(missing.length > 0 ? [`「${missing.join('、')}」未能绘制到海报中`] : [])
          ].join('\n'),
          showCancel: false,
          confirmText: '知道了'
        })
      }, 400)
    }
  }, [buildPosterData, generatePoster, shareSheetLocation])

  const handleClosePoster = useCallback(() => {
    setShowPosterModal(false)
    resetPoster()
  }, [resetPoster])

  const handleSharePosterImage = useCallback(() => {
    if (!posterImageUrl) return
    // @ts-ignore
    Taro.showShareImageMenu({
      path: posterImageUrl,
      fail: (err: { errMsg?: string }) => {
        if (err.errMsg?.includes('no such file') || err.errMsg?.includes('storage')) {
          Taro.showModal({
            title: '分享失败',
            content: '小程序本地存储空间不足，请关闭并重新打开小程序后再试。',
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }
        Taro.showToast({ title: '请先保存图片后再转发', icon: 'none' })
      }
    })
  }, [posterImageUrl])

  const handleSavePoster = useCallback(() => {
    if (!posterImageUrl) return
    Taro.saveImageToPhotosAlbum({
      filePath: posterImageUrl,
      success: () => {
        Taro.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: (err: { errMsg?: string }) => {
        if (err.errMsg?.includes('auth deny') || err.errMsg?.includes('authorize')) {
          Taro.showModal({
            title: '提示',
            content: '需要授权后才能保存图片到相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) Taro.openSetting()
            }
          })
          return
        }
        if (err.errMsg?.includes('no such file') || err.errMsg?.includes('storage')) {
          Taro.showModal({
            title: '保存失败',
            content: '小程序本地存储空间不足，请关闭并重新打开小程序后再试。',
            showCancel: false,
            confirmText: '知道了'
          })
          return
        }
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  }, [posterImageUrl])

  const openLocationInMap = (loc: { id?: string; name: string; latitude: number; longitude: number; country?: string | null; coordinate_system?: LocationCoordinateSystem | null }) => {
    const position = toWeChatCoordinates(loc)
    Taro.navigateTo({ url: `/streetlifting/index/locations-map?latitude=${position.latitude}&longitude=${position.longitude}&name=${encodeURIComponent(loc.name)}&country=${encodeURIComponent(loc.country || '')}${loc.id ? `&id=${encodeURIComponent(loc.id)}` : ''}` })
  }

  const ensureMapPins = async () => {
    const version = ++mapPinsRequestRef.current
    const filters = { equipment: normalizeLocationEquipment(equipmentFilter), country: country === 'all' ? undefined : country, province: province === 'all' ? undefined : province, search: search.trim() || undefined }
    const cacheKey = `map-pins:equipment-v1:${JSON.stringify(filters)}`
    const cached = readLocationCache<StreetliftingLocationMapPin[]>(cacheKey)
    if (!Array.isArray(cached)) setMapPins([])
    if (Array.isArray(cached)) setMapPins(cached.filter((pin) => isValidLocationCoordinates(pin.latitude, pin.longitude)).map(toWeChatCoordinates))
    setLoadingMapPins(true)
    try {
      const pins = await streetliftingIndexService.listLocationMapPins(filters)
      writeLocationCache(cacheKey, pins)
      const displayPins = pins.filter((pin) => isValidLocationCoordinates(pin.latitude, pin.longitude)).map(toWeChatCoordinates)
      if (version === mapPinsRequestRef.current) setMapPins(displayPins)
      return displayPins
    } finally {
      if (version === mapPinsRequestRef.current) setLoadingMapPins(false)
    }
  }

  const handleLocateNearby = async () => {
    if (locating) return
    setLocating(true)
    try {
      const location = await getApproxUserLocation()
      writeLocationCache(`last-user-location:${authService.getCurrentUser()?.id || 'guest'}`, { ...location, locatedAt: Date.now() })
      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude
      })
      try {
        await ensureMapPins()
        Taro.showToast({ title: '已获取当前位置', icon: 'success' })
      } catch (error) {
        Taro.showToast({ title: (error as Error)?.message || '点位加载失败', icon: 'none' })
      }
    } catch (e) {
      if (isLocationPermissionError(e)) {
        Taro.showModal({
          title: '定位权限未开启',
          content: '需要允许定位后才能查看附近单杠。你也可以继续浏览单杠地图。',
          cancelText: '先浏览',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              Taro.openSetting().catch(() => {
                Taro.showToast({ title: '打开设置失败', icon: 'none' })
              })
            }
          }
        })
      } else {
        Taro.showToast({ title: (e as Error)?.message || '定位暂不可用，可先浏览世界地图', icon: 'none' })
      }
    } finally {
      setLocating(false)
    }
  }

  const handleOpenMapMode = () => {
    const filters = { equipment: normalizeLocationEquipment(equipmentFilter), country: country === 'all' ? undefined : country, province: province === 'all' ? undefined : province, search: search.trim() || undefined }
    Taro.navigateTo({
      url: `/streetlifting/index/locations-map?filters=${encodeURIComponent(JSON.stringify(filters))}`
    }).catch(() => {
      Taro.showToast({ title: '打开地图失败', icon: 'none' })
    })
  }

  const nearbyLocations = useMemo<NearbyLocation[]>(() => {
    if (!userLocation || mapPins.length === 0) return []
    return [...mapPins]
      .filter(pin => matchesLocationEquipment(pin, equipmentFilter))
      .map((pin) => ({
        ...pin,
        distanceKm: calculateDistanceKm(userLocation, {
          latitude: pin.latitude,
          longitude: pin.longitude
        })
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5)
  }, [mapPins, userLocation, equipmentFilter])

  const primaryOverviewCards = useMemo(() => {
    if (!locationOverview) return []
    return [
      { label: '全部点位', value: String(locationOverview.totalCount), icon: 'icon-location' },
      { label: '带图片', value: String(locationOverview.withImagesCount), icon: 'icon-picture' },
      { label: '覆盖省份', value: String(locationOverview.provinceCount), icon: 'icon-city' }
    ]
  }, [locationOverview])

  const secondaryOverviewCards = useMemo(() => {
    if (!locationOverview) return []
    return [
      {
        label: '图片覆盖率',
        value: formatRate(locationOverview.withImagesCount, locationOverview.totalCount),
        helper: `${locationOverview.withImagesCount} / ${locationOverview.totalCount} 有图`,
        icon: 'icon-picture'
      },
      {
        label: '描述覆盖率',
        value: formatRate(locationOverview.withDescriptionCount, locationOverview.totalCount),
        helper: `${locationOverview.withDescriptionCount} / ${locationOverview.totalCount} 有描述`,
        icon: 'icon-pinglun'
      },
      {
        label: '平均图片数',
        value: String(locationOverview.averageImageCount),
        helper: '每个点位的平均图片数量',
        icon: 'icon-calculator'
      },
      {
        label: '可地图打开',
        value: String(locationOverview.mapReadyCount),
        helper: '已带经纬度，可直接导航',
        icon: 'icon-location'
      },
      {
        label: '贡献者数',
        value: String(locationOverview.contributorCount),
        helper: '已建立贡献累计的上传者',
        icon: 'icon-user'
      }
    ]
  }, [locationOverview])

  const displayContributors = useMemo(() => contributors.slice(0, 3), [contributors])
  const sharedFocusLocation = sharedLocation || sharedLocationPreview
  const displayLocations = useMemo(() => {
    if (!sharedLocation || !matchesLocationEquipment(sharedLocation, equipmentFilter)) return locations
    return [sharedLocation, ...locations.filter((item) => item.id !== sharedLocation.id)]
  }, [locations, sharedLocation, equipmentFilter])

  const hasMore = locations.length < total

  const loadMore = () => {
    if (loading || !hasMore) return
    void fetchLocations(page + 1, true)
  }

  const TAB_LIST = [
    { key: 0, label: '单杠列表' },
    { key: 1, label: '单杠数据' },
    { key: 2, label: '贡献排行榜' }
  ]

  const renderSkeleton = () => {
    if (activeTab === 0) {
      // Tab 0: 地点卡片骨架 ×3
      return (
        <View className='loc-skeleton-wrap'>
          {[1, 2, 3].map((i) => (
            <View key={`loc-${i}`} className='loc-skeleton-card'>
              <View className='loc-skeleton-img' />
              <View className='loc-skeleton-body'>
                <View className='loc-skeleton-line' style={{ width: '60%', height: '32rpx', marginBottom: '12rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '40%', height: '24rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '80%', height: '24rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '50%', height: '24rpx' }} />
              </View>
            </View>
          ))}
        </View>
      )
    }
    if (activeTab === 1) {
      // Tab 1: 统计卡片 + 二级统计 + 图表骨架
      return (
        <View className='loc-skeleton-wrap'>
          {/* 主统计骨架 */}
          <View className='loc-stats compact skeleton-stats'>
            {[1, 2, 3].map((i) => (
              <View key={`stat-${i}`} className='stat-card skeleton-stat'>
                <View className='skeleton-circle' style={{ width: '40rpx', height: '40rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '50%', height: '36rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '60%', height: '24rpx' }} />
              </View>
            ))}
          </View>
          {/* 按钮骨架 */}
          <View className='loc-header-actions skeleton-actions'>
            <View className='loc-skeleton-line' style={{ flex: 1, height: '80rpx', borderRadius: '16rpx' }} />
            <View className='loc-skeleton-line' style={{ flex: 1, height: '80rpx', borderRadius: '16rpx' }} />
          </View>
          {/* 二级统计骨架 */}
          <View className='overview-secondary-stats skeleton-secondary'>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={`sec-${i}`} className='overview-secondary-card skeleton-sec-card'>
                <View className='skeleton-circle' style={{ width: '32rpx', height: '32rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '70%', height: '24rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '50%', height: '32rpx', marginBottom: '8rpx' }} />
                <View className='loc-skeleton-line' style={{ width: '80%', height: '20rpx' }} />
              </View>
            ))}
          </View>
        </View>
      )
    }
    // Tab 2: 排行榜条目骨架 ×5
    return (
      <View className='loc-skeleton-wrap'>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={`rank-${i}`} className='contribution-item skeleton-rank-item'>
            <View className='skeleton-circle' style={{ width: '48rpx', height: '48rpx', flexShrink: 0 }} />
            <View className='skeleton-rank-meta'>
              <View className='loc-skeleton-line' style={{ width: '40%', height: '28rpx', marginBottom: '8rpx' }} />
              <View className='loc-skeleton-line' style={{ width: '70%', height: '22rpx' }} />
            </View>
            <View className='loc-skeleton-line' style={{ width: '80rpx', height: '32rpx', flexShrink: 0 }} />
          </View>
        ))}
      </View>
    )
  }

  return (
    <View className={`loc-page theme-${effectiveTheme}`}>
      {(sharedLocationLoading || sharedFocusLocation) && (
        <View className='share-focus-card'>
          <Text className='share-focus-eyebrow'>来自分享</Text>
          {sharedFocusLocation ? (
            <>
              <Text className='share-focus-title'>{sharedFocusLocation.name}</Text>
              <Text className='share-focus-desc'>
                {[sharedFocusLocation.province, sharedFocusLocation.city, sharedFocusLocation.county, sharedFocusLocation.address]
                  .filter(Boolean)
                  .join(' ') || '打开后可继续查看地点详情、图片和导航'}
              </Text>
            </>
          ) : (
            <Text className='share-focus-desc'>正在定位被分享的单杠地点...</Text>
          )}
        </View>
      )}

      {/* ===== 分享按钮 ===== */}
      <View className='btn-share-my-bar' onClick={openCreate}>
        <Text className='iconfont icon-location' />
        <Text>分享我的单杠位置</Text>
      </View>

      {/* ===== Tab 导航 ===== */}
      <View className='loc-tab-bar'>
        {TAB_LIST.map((tab) => (
          <View
            key={tab.key}
            className={`loc-tab-item ${activeTab === tab.key ? 'loc-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className='loc-tab-text'>{tab.label}</Text>
            {activeTab === tab.key && <View className='loc-tab-indicator' />}
          </View>
        ))}
      </View>

      {/* ===== Tab 内容 ===== */}
      <View className='loc-tab-content'>
        {/* --- Tab 0: 单杠列表 --- */}
        {activeTab === 0 && (
          <ScrollView
            className='loc-tab-panel-scroll'
            scrollY
            onScrollToLower={loadMore}
            lowerThreshold={100}
          >
            <View className='loc-list-section'>
              <View className='loc-header compact'>
                <View className='loc-header-actions'>
                  <View className='loc-summary-secondary loc-summary-half' onClick={handleOpenMapMode}>
                    <Text className='iconfont icon-location' />
                  <Text>查看单杠地图</Text>
                  </View>
                  <View className='loc-summary-action loc-summary-half' onClick={handleLocateNearby}>
                    <Text>{locating ? '定位中…' : '定位我附近'}</Text>
                  </View>
                </View>
              </View>

              <EquipmentSelector filter value={equipmentFilter} onChange={setEquipmentFilter} />
              {userLocation && (
                <View className='user-location-row'>
                  <Text className='user-location-text'>
                    已获取当前位置，可直接在地图中打开最近的单杠点位
                  </Text>
                </View>
              )}

              {nearbyLocations.length > 0 && (
                <View className='nearby-section'>
                  <Text className='nearby-title'>离你最近</Text>
                  <View className='nearby-list'>
                    {nearbyLocations.map((item) => (
                      <NearbyLocationCard key={item.id} location={item} onOpenMap={openLocationInMap} onPreview={previewLocationImages} />
                    ))}
                  </View>
                </View>
              )}

              <View className='loc-toolbar'>
                <Input
                  className='search-input'
                  placeholder='搜索名称/国家/城市/地址'
                  value={search}
                  onInput={(e) => setSearch(e.detail.value)}
                />
                <Picker
                  mode='selector'
                  range={['全部省/州', ...provinces]}
                  value={province === 'all' ? 0 : Math.max(0, provinces.indexOf(province) + 1)}
                  onChange={(e) => {
                    const i = Number(e.detail.value)
                    setProvince(i === 0 ? 'all' : (provinces[i - 1] || 'all'))
                  }}
                >
                  <View className='picker-province'>{province === 'all' ? '全部省/州' : province}</View>
                </Picker>
              </View>

              <Picker mode='selector' range={['全部国家/地区', ...countryOptions]} value={country === 'all' ? 0 : Math.max(0, countryOptions.indexOf(country) + 1)} onChange={(e) => { setCountry(Number(e.detail.value) === 0 ? 'all' : countryOptions[Number(e.detail.value) - 1]); setProvince('all') }}>
                <View className='country-filter'>{country === 'all' ? '全部国家/地区' : country}</View>
              </Picker>

              {loading && locations.length === 0 ? (
                renderSkeleton()
              ) : locations.length === 0 ? (
                <View className='empty-wrap'>
                  <Text>{equipmentFilter.length ? '没有找到符合器材条件的点位' : '暂无地点信息'}</Text>
                  <Text className='empty-hint'>{equipmentFilter.length ? '试试减少器材条件，或选择全部器材' : '成为第一个分享者吧'}</Text>
                </View>
              ) : (
                <View className='loc-list'>
                  {displayLocations.map((loc) => (
                    <View key={loc.id} className={`loc-card ${loc.id === sharedLocationId ? 'loc-card-shared' : ''}`}>
                      <View className='loc-card-image-wrap' onClick={() => void previewLocationImages(loc)}>
                        {getLocationImages(loc).length > 0 ? (
                          <Image
                            className='loc-card-img'
                            src={getLocationImages(loc)[0]}
                            mode='aspectFill'
                          />
                        ) : (
                          <View className='loc-card-noimg'>
                            <Text>暂无图片</Text>
                          </View>
                        )}
                        {hasLocationImages(loc) && (
                          <View className='loc-card-badge'>
                            <Text>{getLocationImages(loc).length} 张图 · 点击查看</Text>
                          </View>
                        )}
                        {loc.id === sharedLocationId && (
                          <View className='loc-shared-badge'>
                            <Text>分享点位</Text>
                          </View>
                        )}
                        <Button
                          className='loc-card-img-share'
                          onClick={(event) => { event.stopPropagation(); handleOpenShareOptions(loc) }}
                        >
                          <Text className='iconfont icon-share' />
                        </Button>
                      </View>
                      <View className='loc-card-body'>
                        <View className='loc-card-title-row'>
                          <Text className='loc-card-name' numberOfLines={1}>{loc.name}</Text>
                          {loc.latitude != null && loc.longitude != null && (
                            <View
                              className='loc-card-map-btn'
                              onClick={() => openLocationInMap({
                                id: loc.id,
                                name: loc.name,
                                country: loc.country,
                                coordinate_system: loc.coordinate_system,
                                latitude: loc.latitude as number,
                                longitude: loc.longitude as number,
                              })}
                            >
                              <Text className='iconfont icon-location' />
                              <Text className='loc-card-map-text'>查看地图</Text>
                            </View>
                          )}
                        </View>
                        <View className='loc-card-meta-list'>
                          <Text className='loc-card-meta-item'>
                            {[loc.country, loc.province, loc.city, loc.county].filter(Boolean).join(' · ')}
                          </Text>
                          {(loc.contributor_name_snapshot || loc.user_contact) && loc.contributor_user_id ? (
                            <Text
                              className='loc-card-meta-item loc-card-meta-user'
                              onClick={() => Taro.navigateTo({ url: `/me/user/index?userId=${loc.contributor_user_id}` })}
                            >
                              贡献者：{getContributorLabel(loc)}
                            </Text>
                          ) : (loc.contributor_name_snapshot || loc.user_contact) ? (
                            <Text className='loc-card-meta-item'>
                              贡献者：{getContributorLabel(loc)}
                            </Text>
                          ) : null}
                          {loc.address ? (
                            <Text className='loc-card-meta-item'>{loc.address}</Text>
                          ) : null}
                        </View>
                        <EquipmentTags location={loc} />
                        {loc.description ? (
                          <View className='loc-card-desc-row'>
                            <Text className='loc-card-desc' numberOfLines={2}>{loc.description}</Text>
                            <View className='loc-card-edit-btn' onClick={() => openEdit(loc)}>
                              <Text className='iconfont icon-pencil' />
                              <Text className='loc-card-edit-text'>编辑位置</Text>
                            </View>
                          </View>
                        ) : (
                          <View className='loc-card-desc-row'>
                            <View style={{ flex: 1 }} />
                            <View className='loc-card-edit-btn' onClick={() => openEdit(loc)}>
                              <Text className='iconfont icon-pencil' />
                              <Text className='loc-card-edit-text'>编辑位置</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {loading && locations.length > 0 && <View className='loading-more'><LoadingSpinner size={48} /></View>}
              {hasMore && !loading && (
                <View className='load-more' onClick={loadMore}><Text>加载更多</Text></View>
              )}
            </View>
          </ScrollView>
        )}

        {/* --- Tab 1: 单杠数据 --- */}
        {activeTab === 1 && (
          <ScrollView className='loc-tab-panel-scroll' scrollY>
            <View className='loc-data-section'>
              {loadingOverview ? (
                renderSkeleton()
              ) : locationOverview ? (
                <>
                  <View className='loc-stats compact'>
                    {primaryOverviewCards.map((item) => (
                      <View key={item.label} className='stat-card'>
                        <Text className={`iconfont ${item.icon} stat-icon`} />
                        <Text className='stat-value'>{item.value}</Text>
                        <Text className='stat-label'>{item.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View className='overview-secondary-stats'>
                    {secondaryOverviewCards.map((item) => (
                      <View key={item.label} className='overview-secondary-card'>
                        <Text className={`iconfont ${item.icon} overview-secondary-icon`} />
                        <Text className='overview-secondary-label'>{item.label}</Text>
                        <Text className='overview-secondary-value'>{item.value}</Text>
                        <Text className='overview-secondary-helper'>{item.helper}</Text>
                      </View>
                    ))}
                  </View>

                  {locationOverview.topProvinces.length > 0 && (
                    <View className='analysis-block'>
                      <Text className='analysis-block-title'>省份分布 Top 6</Text>
                      <View className='analysis-rank-list'>
                        {locationOverview.topProvinces.map((item) => (
                          <View key={item.name} className='analysis-rank-item'>
                            <View className='analysis-rank-head'>
                              <Text className='analysis-rank-name'>{item.name}</Text>
                              <Text className='analysis-rank-count'>{item.count}</Text>
                            </View>
                            <View className='analysis-rank-track'>
                              <View
                                className='analysis-rank-fill'
                                style={{ width: `${Math.max(12, Math.round((item.count / Math.max(locationOverview.topProvinces[0]?.count || 1, 1)) * 100))}%` }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {locationOverview.recentMonths.length > 0 && (
                    <View className='analysis-block'>
                      <Text className='analysis-block-title'>最近 6 个月新增趋势</Text>
                      <View className='trend-chart'>
                        {(() => {
                          const maxMonthCount = Math.max(...locationOverview.recentMonths.map(m => m.count), 1)
                          return locationOverview.recentMonths.map((item) => (
                            <View key={item.month} className='trend-chart-item'>
                              <Text className='trend-chart-value'>{item.count}</Text>
                              <View className='trend-chart-bar-wrap'>
                                <View
                                  className='trend-chart-bar'
                                  style={{ height: `${Math.max(8, Math.round((item.count / maxMonthCount) * 100))}%` }}
                                />
                              </View>
                              <Text className='trend-chart-label'>{formatMonthLabel(item.month)}</Text>
                            </View>
                          ))
                        })()}
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <View className='summary-loading'>
                  <Text>暂时没有可展示的总览分析</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* --- Tab 2: 贡献排行榜 --- */}
        {activeTab === 2 && (
          <ScrollView className='loc-tab-panel-scroll' scrollY>
            <View className='loc-leaderboard-section'>
              <View className='contribution-mini-head'>
                <Text className='iconfont icon-ranking contribution-title-icon' />
              </View>

              {loadingContributors ? (
                renderSkeleton()
              ) : contributors.length === 0 ? (
                <View className='contribution-empty'>
                  <Text>当前可识别的署名贡献还不多，新的分享会开始累计上榜。</Text>
                </View>
              ) : (
                <View className='contribution-list'>
                  {contributors.slice(0, 10).map((item, index) => (
                    <View key={item.contributor_key} className='contribution-item'>
                      <View className='contribution-rank'>
                        <Text>{index + 1}</Text>
                      </View>
                      <View className='contribution-main'>
                        <Text className='contribution-name'>{formatContributorName(item.display_name)}</Text>
                        <Text className='contribution-meta'>
                          {item.upload_count} 次上传 · 详细度 {item.detail_score_total} 分 · {item.image_count_total} 张图
                        </Text>
                      </View>
                      <View className='contribution-score'>
                        <Text className='contribution-score-value'>{item.contribution_score}</Text>
                        <Text className='contribution-score-label'>贡献分</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View className='contribution-rights-note'>
                <Text>权益方向：贡献徽章、内测优先权、训练资料兑换等都会优先参考这份贡献分，后续可以直接映射到产品权益体系。</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>

      {/* ===== 分析数据底部弹窗 ===== */}
      {analysisSheetOpen && (
        <View className='sheet-mask' onClick={() => setAnalysisSheetOpen(false)}>
          <View className='sheet-box' onClick={(e) => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>点位总体分析</Text>
              <View className='sheet-close' onClick={() => setAnalysisSheetOpen(false)}>
                <Text>×</Text>
              </View>
            </View>
            <ScrollView scrollY className='sheet-scroll'>
              {locationOverview && (
                <>
                  <View className='overview-secondary-stats'>
                    {secondaryOverviewCards.map((item) => (
                      <View key={item.label} className='overview-secondary-card'>
                        <Text className={`iconfont ${item.icon} overview-secondary-icon`} />
                        <Text className='overview-secondary-label'>{item.label}</Text>
                        <Text className='overview-secondary-value'>{item.value}</Text>
                        <Text className='overview-secondary-helper'>{item.helper}</Text>
                      </View>
                    ))}
                  </View>

                  {locationOverview.topProvinces.length > 0 && (
                    <View className='analysis-block'>
                      <Text className='analysis-block-title'>省份分布 Top 6</Text>
                      <View className='analysis-rank-list'>
                        {locationOverview.topProvinces.map((item) => (
                          <View key={item.name} className='analysis-rank-item'>
                            <View className='analysis-rank-head'>
                              <Text className='analysis-rank-name'>{item.name}</Text>
                              <Text className='analysis-rank-count'>{item.count}</Text>
                            </View>
                            <View className='analysis-rank-track'>
                              <View
                                className='analysis-rank-fill'
                                style={{ width: `${Math.max(12, Math.round((item.count / Math.max(locationOverview.topProvinces[0]?.count || 1, 1)) * 100))}%` }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {locationOverview.recentMonths.length > 0 && (
                    <View className='analysis-block'>
                      <Text className='analysis-block-title'>最近 6 个月新增趋势</Text>
                      <View className='trend-chart'>
                        {(() => {
                          const maxMonthCount = Math.max(...locationOverview.recentMonths.map(m => m.count), 1)
                          return locationOverview.recentMonths.map((item) => (
                            <View key={item.month} className='trend-chart-item'>
                              <Text className='trend-chart-value'>{item.count}</Text>
                              <View className='trend-chart-bar-wrap'>
                                <View
                                  className='trend-chart-bar'
                                  style={{ height: `${Math.max(8, Math.round((item.count / maxMonthCount) * 100))}%` }}
                                />
                              </View>
                              <Text className='trend-chart-label'>{formatMonthLabel(item.month)}</Text>
                            </View>
                          ))
                        })()}
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ===== 贡献榜底部弹窗 ===== */}
      {leaderboardSheetOpen && (
        <View className='sheet-mask' onClick={() => setLeaderboardSheetOpen(false)}>
          <View className='sheet-box' onClick={(e) => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>单杠贡献排行榜</Text>
              <View className='sheet-close' onClick={() => setLeaderboardSheetOpen(false)}>
                <Text>×</Text>
              </View>
            </View>
            <ScrollView scrollY className='sheet-scroll'>
              {loadingContributors ? (
                <View className='contribution-loading'>
                  <LoadingSpinner size={48} />
                </View>
              ) : contributors.length === 0 ? (
                <View className='contribution-empty'>
                  <Text>当前可识别的署名贡献还不多，新的分享会开始累计上榜。</Text>
                </View>
              ) : (
                <View className='contribution-list'>
                  {contributors.slice(0, 10).map((item, index) => (
                    <View key={item.contributor_key} className='contribution-item'>
                      <View className='contribution-rank'>
                        <Text>{index + 1}</Text>
                      </View>
                      <View className='contribution-main'>
                        <Text className='contribution-name'>{formatContributorName(item.display_name)}</Text>
                        <Text className='contribution-meta'>
                          {item.upload_count} 次上传 · 详细度 {item.detail_score_total} 分 · {item.image_count_total} 张图
                        </Text>
                      </View>
                      <View className='contribution-score'>
                        <Text className='contribution-score-value'>{item.contribution_score}</Text>
                        <Text className='contribution-score-label'>贡献分</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ===== 权益说明底部弹窗 ===== */}
      {rightsSheetOpen && (
        <View className='sheet-mask' onClick={() => setRightsSheetOpen(false)}>
          <View className='sheet-box' onClick={(e) => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>贡献权益说明</Text>
              <View className='sheet-close' onClick={() => setRightsSheetOpen(false)}>
                <Text>×</Text>
              </View>
            </View>
            <ScrollView scrollY className='sheet-scroll'>
              <View className='contribution-rights-note'>
                <Text>权益方向：贡献徽章、内测优先权、训练资料兑换等都会优先参考这份贡献分，后续可以直接映射到产品权益体系。</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {shareSheetLocation && (
        <View className='sheet-mask' onClick={handleCloseShareSheet}>
          <View className='sheet-box share-sheet-box' onClick={(e) => e.stopPropagation()}>
            <View className='sheet-header'>
              <Text className='sheet-title'>分享这个单杠点位</Text>
              <View className='sheet-close' onClick={handleCloseShareSheet}>
                <Text>脳</Text>
              </View>
            </View>

            <View className='share-sheet-summary'>
              <Text className='share-sheet-name'>{shareSheetLocation.name}</Text>
              <Text className='share-sheet-desc'>
                {[shareSheetLocation.province, shareSheetLocation.city, shareSheetLocation.county, shareSheetLocation.address]
                  .filter(Boolean)
                  .join(' ') || '分享后可回到 CoachLink 查看完整点位'}
              </Text>
            </View>

            <View className='share-sheet-actions'>
              <Button className='share-sheet-btn share-sheet-btn-primary' openType='share' onClick={handlePrepareLinkShare}>
                分享链接
              </Button>
              <Button className='share-sheet-btn share-sheet-btn-secondary' onClick={handleOpenPoster}>
                生成海报
              </Button>
            </View>

            <Text className='share-sheet-hint'>
              分享链接适合发群聊并跳回这个点位；生成海报适合保存图片后转发。
            </Text>
          </View>
        </View>
      )}

      <SharePosterModal
        visible={showPosterModal}
        onClose={handleClosePoster}
        title='单杠点位海报'
        canvasId='streetlifting-location-poster-canvas'
        canvasHeight={1100}
        posterImageUrl={posterImageUrl}
        onShareImage={handleSharePosterImage}
        onSaveImage={handleSavePoster}
        generating={posterGenerating}
      />

      {/* ===== 表单弹窗 ===== */}
      {dialogOpen && (
        <View className='dialog-mask' onClick={() => { setDialogOpen(false); resetForm() }}>
          <View className='dialog-box' onClick={(e) => e.stopPropagation()}>
            <Text className='dialog-title'>{editing ? '编辑单杠位置' : '分享单杠位置'}</Text>
            <Text className='location-step'>{hasSelectedPosition || manualDetailsOpen ? '核对地址，补充单杠信息' : '先选地图位置，地址自动带回'}</Text>
            <ScrollView scrollY className='dialog-scroll'>
              <View className='location-country-row'>
                <Text>{overseasLocation ? '海外地点' : '地点在中国（默认）'}</Text>
                <Button className='location-secondary country-switch' onClick={() => { setOverseasLocation(!overseasLocation); changeLocationCountry(overseasLocation ? '中国' : '') }}>{overseasLocation ? '切回中国' : '海外地点'}</Button>
              </View>
              {overseasLocation && <View className='form-row'>
                      <Text className='label'>国家 / 地区 *</Text>
                      <View className='location-picker-row'>
                      <Input className='input country-input' placeholder='例如：日本、英国' maxlength={100} value={form.country} onInput={(e) => changeLocationCountry(e.detail.value)} />
                      <Picker mode='selector' range={COUNTRY_OPTIONS} value={Math.max(0, COUNTRY_OPTIONS.indexOf(form.country))} onChange={(e) => { const selected = COUNTRY_OPTIONS[Number(e.detail.value)]; changeLocationCountry(selected === '其他（自行填写）' ? '' : selected) }}><View className='location-picker-btn'>选择</View></Picker>
                      </View>
              </View>}
              <View className='location-selection-summary'>
                <Text className='location-start-title'>{hasSelectedPosition ? '已选地图位置' : '选择单杠位置'}</Text>
                <Text className='location-selected-address'>{hasSelectedPosition ? form.address || '位置已记录，地图未返回详细地址，请在下面补充。' : '默认打开你附近的位置。搜索公园或地址，确认单杠位置后自动带回名称和地址。'}</Text>
                <Button className='map-picker-entry location-primary' onClick={chooseLocation} disabled={openingPicker}>{openingPicker ? '正在定位 / 打开地图…' : hasSelectedPosition ? '重新选择位置' : '搜索地点 / 选择位置'}</Button>
                {hasSelectedPosition && <Text className='location-form-help'>请核对下面的名称和地址；不准确的直接修改，如何找到单杠可另外补充。</Text>}
                {!hasSelectedPosition && !manualDetailsOpen && <Button className='location-secondary manual-location-entry' onClick={() => setManualDetailsOpen(true)}>地图不可用？手动填写</Button>}
                {manualDetailsOpen && !hasSelectedPosition && <Text className='location-form-help'>可以先保存文字信息。未选择地图位置时，只在列表显示，暂不能地图导航。</Text>}
              </View>
              {(hasSelectedPosition || manualDetailsOpen) && <>
                <View className='form-row'>
                  <Text className='label'>单杠名称 *</Text>
                  <Input className='input location-name-input' placeholder='例如：学知园北门单杠' value={form.name} onInput={e => setForm(p => ({ ...p, name: e.detail.value }))} />
                </View>
                <View className='location-country-row'>
                  <Text>{Array.from(new Set([form.country, form.province, form.city, form.county].filter(Boolean))).join(' · ')}</Text>
                  <Button className='location-secondary' onClick={() => setRegionDetailsOpen(value => !value)}>{regionDetailsOpen ? '收起地区' : '修改地区'}</Button>
                </View>
                {regionDetailsOpen && <>
                  <View className='form-row'><Text className='label'>{overseasLocation ? '省 / 州（选填）' : '省 / 直辖市（选填）'}</Text><Input className='input location-province-input' placeholder='例如：北京市' value={form.province} onInput={e => setForm(p => ({ ...p, province: e.detail.value }))} /></View>
                  <View className='form-row'><Text className='label'>城市（选填）</Text><Input className='input location-city-input' placeholder='例如：北京市' value={form.city} onInput={e => setForm(p => ({ ...p, city: e.detail.value }))} /></View>
                  <View className='form-row'><Text className='label'>区县（选填）</Text><Input className='input location-county-input' placeholder='例如：海淀区' value={form.county} onInput={e => setForm(p => ({ ...p, county: e.detail.value }))} /></View>
                </>}
                <View className='form-row equipment-form'>
                  <Text className='label'>这里有哪些器材？（可多选）</Text>
                  <EquipmentSelector value={equipmentTypes} onChange={value => { equipmentTouchedRef.current = true; setEquipmentTypes(value) }} />
                  <Text className='equipment-hint'>{!equipmentTouchedRef.current && equipmentTypes.length ? '已根据名称或描述预选，请按现场情况核对' : '按现场情况选择；未填写也可以分享'}</Text>
                </View>
                <View className='form-row'>
                  <Text className='label'>地点地址（可修改，未获取时补充）</Text>
                  <Textarea className='input location-address-input' placeholder='例如：北京市海淀区海淀路46号附近' maxlength={500} value={form.address} onInput={e => setForm(p => ({ ...p, address: e.detail.value }))} />
                </View>
                <View className='form-row'>
                  <Text className='label'>补充说明（选填）</Text>
                  <Input className='input' placeholder='例如：北门进入后右转，篮球场旁边' value={form.description} onInput={e => setForm(p => ({ ...p, description: e.detail.value }))} />
                </View>
              <View className='form-row'>
                <Text className='label'>图片（最多{MAX_IMAGES}张）</Text>
                <View className='img-list'>
                  {imageUrls.map((url, i) => (
                    <View key={i} className='img-item'>
                      <Image src={url} mode='aspectFill' className='img-preview' />
                      <View className='img-remove' onClick={() => removeImage(i)}><Text>×</Text></View>
                    </View>
                  ))}
                  {imageUrls.length < MAX_IMAGES && (
                    <View className='img-add' onClick={chooseImage}>
                      <Text>{uploading ? '上传中…' : '+'}</Text>
                    </View>
                  )}
                </View>
              </View>
              </>}
            </ScrollView>
            <View className='dialog-actions'>
              <Button className='btn-cancel' onClick={() => { setDialogOpen(false); resetForm() }}>取消</Button>
              {(hasSelectedPosition || manualDetailsOpen) && <Button className='btn-ok' onClick={handleSubmit} disabled={submitting || uploading || openingPicker}>{submitting ? '保存中…' : editing ? '保存修改' : '分享单杠'}</Button>}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
