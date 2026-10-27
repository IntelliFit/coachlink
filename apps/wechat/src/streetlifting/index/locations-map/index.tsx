import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Input, Map as TaroMap } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'

import {
  streetliftingIndexService,
  type StreetliftingLocationMapPin
} from '@/services/streetliftingIndexService'
import locationClusterIcon from '@/assets/map/location-cluster.png'
import locationPinIcon from '@/assets/map/location-pin.png'
import { LoadingSpinner } from '@/components/LoadingSpinner'

import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { isValidLocationCoordinates, toWeChatCoordinates, DEFAULT_LOCATION_MAP_VIEW, getInitialLocationMapView, getGestureMapScale, normalizeLocationEquipment, type LocationEquipmentType, type LocationSelection, type LocationSearchResult, type LocationMapView } from '@coachlink/core'
import { EquipmentSelector, EquipmentTags } from '@/components/LocationEquipment'
import { readLocationCache, writeLocationCache, type LocationDraft } from '@/utils/streetliftingLocationCache'
import { getApproxUserLocation } from '@/utils/approxLocation'
import { usableSearchSelection } from '@/utils/locationPicker'
import { authService } from '@/services/authService'

type ClusterMarkerMeta =
  | {
      kind: 'single'
      markerId: number
      pin: StreetliftingLocationMapPin
    }
  | {
      kind: 'cluster'
      markerId: number
      pins: StreetliftingLocationMapPin[]
      latitude: number
      longitude: number
    }

type DisplayMarker = {
  id: number
  latitude: number
  longitude: number
  iconPath: string
  width: number
  height: number
  anchor?: { x: number; y: number }
  callout?: {
    content: string
    display: 'ALWAYS' | 'BYCLICK'
    fontSize: number
    borderRadius: number
    padding: number
    bgColor: string
    color: string
    textAlign?: 'center'
  }
}

type UserLocation = {
  latitude: number
  longitude: number
}

const DEFAULT_CENTER = {
  latitude: DEFAULT_LOCATION_MAP_VIEW.latitude,
  longitude: DEFAULT_LOCATION_MAP_VIEW.longitude
}

const DEFAULT_SCALE = DEFAULT_LOCATION_MAP_VIEW.scale
const MAX_CLUSTER_LABEL_COUNT = 99
const CLUSTER_ID_BASE = 100000
// getFuzzyLocation is km-level: open the picker at neighbourhood zoom so nobody mistakes it for an exact spot.
const FUZZY_PICK_SCALE = 14

function getClusterCellSize(scale: number): number {
  if (scale <= 4) return 5.5
  if (scale <= 5) return 2.8
  if (scale <= 6) return 1.6
  if (scale <= 7) return 0.9
  if (scale <= 8) return 0.45
  if (scale <= 9) return 0.24
  if (scale <= 10) return 0.12
  if (scale <= 11) return 0.06
  if (scale <= 12) return 0.03
  if (scale <= 13) return 0.015
  return 0.008
}

function formatArea(pin: StreetliftingLocationMapPin): string {
  return [pin.country, pin.province, pin.city, pin.county].filter(Boolean).join(' · ') || '未补充区域信息'
}

function formatAddress(pin: StreetliftingLocationMapPin): string {
  return [pin.country, pin.province, pin.city, pin.county, pin.address].filter(Boolean).join(' ')
}

function createClusterMarkers(
  pins: StreetliftingLocationMapPin[],
  scale: number
): {
  markers: DisplayMarker[]
  metaMap: Map<number, ClusterMarkerMeta>
} {
  const cellSize = getClusterCellSize(scale)
  const buckets = new globalThis.Map<string, StreetliftingLocationMapPin[]>()

  pins.forEach((pin) => {
    const key = `${Math.floor(pin.latitude / cellSize)}:${Math.floor(pin.longitude / cellSize)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(pin)
    else buckets.set(key, [pin])
  })

  const markers: DisplayMarker[] = []
  const metaMap = new globalThis.Map<number, ClusterMarkerMeta>()
  let clusterIndex = 0
  let singleIndex = 0

  buckets.forEach((bucket) => {
    if (bucket.length === 1) {
      const pin = bucket[0]
      singleIndex += 1
      const markerId = singleIndex
      markers.push({
        id: markerId,
        latitude: pin.latitude,
        longitude: pin.longitude,
        iconPath: locationPinIcon,
        width: 28,
        height: 36,
        anchor: { x: 0.5, y: 1 },
        callout: {
          content: pin.name,
          display: 'BYCLICK',
          fontSize: 12,
          borderRadius: 12,
          padding: 8,
          bgColor: '#ffffff',
          color: '#111827'
        }
      })
      metaMap.set(markerId, { kind: 'single', markerId, pin })
      return
    }

    clusterIndex += 1
    const markerId = CLUSTER_ID_BASE + clusterIndex
    const latitude = bucket.reduce((sum, item) => sum + item.latitude, 0) / bucket.length
    const longitude = bucket.reduce((sum, item) => sum + item.longitude, 0) / bucket.length
    const label = bucket.length > MAX_CLUSTER_LABEL_COUNT ? `${MAX_CLUSTER_LABEL_COUNT}+` : String(bucket.length)

    markers.push({
      id: markerId,
      latitude,
      longitude,
      iconPath: locationClusterIcon,
      width: 34,
      height: 34,
      anchor: { x: 0.5, y: 0.5 },
      callout: {
        content: label,
        display: 'ALWAYS',
        fontSize: 12,
        borderRadius: 999,
        padding: 8,
        bgColor: '#ffffff',
        color: '#b91c1c',
        textAlign: 'center'
      }
    })
    metaMap.set(markerId, {
      kind: 'cluster',
      markerId,
      pins: bucket,
      latitude,
      longitude
    })
  })

  return { markers, metaMap }
}

function getMapContext(mapId: string) {
  return Taro.createMapContext(mapId)
}

function getCurrentScale(mapId: string): Promise<number | null> {
  const ctx = getMapContext(mapId)
  return new Promise((resolve) => {
    ctx.getScale({
      success: (res: any) => resolve(typeof res?.scale === 'number' && Number.isFinite(res.scale) ? res.scale : null),
      fail: () => resolve(null)
    })
  })
}

function getCurrentCenter(mapId: string): Promise<UserLocation | null> {
  const ctx = getMapContext(mapId)
  return new Promise((resolve) => {
    ctx.getCenterLocation({
      success: (res: any) => {
        if (typeof res?.latitude === 'number' && typeof res?.longitude === 'number') {
          resolve({ latitude: res.latitude, longitude: res.longitude })
          return
        }
        resolve(null)
      },
      fail: () => resolve(null)
    })
  })
}

export default function StreetliftingLocationsMapPage() {
  const { effectiveTheme } = useTheme()
  const mapIdRef = useRef(`streetlifting-map-${Date.now()}`)
  const markerMetaRef = useRef(new globalThis.Map<number, ClusterMarkerMeta>())
  const [params, setParams] = useState<Record<string, string>>({})
  const [ready, setReady] = useState(false)
  const [equipmentFilter, setEquipmentFilter] = useState<LocationEquipmentType[]>([])
  const [browseFilters, setBrowseFilters] = useState<{ country?: string; province?: string; search?: string }>({})
  const paramsRef = useRef(params)
  paramsRef.current = params
  useLoad((options) => {
    setParams(options || {})
    try {
      const raw = options?.filters || '{}'
      let filters: { equipment?: unknown; country?: string; province?: string; search?: string }
      try { filters = JSON.parse(raw) } catch { filters = JSON.parse(decodeURIComponent(raw)) }
      setEquipmentFilter(normalizeLocationEquipment(filters.equipment))
      setBrowseFilters({ country: filters.country, province: filters.province, search: filters.search })
    } catch { /* Old deep links have no filters. */ }
    setReady(true)
  })
  const pickMode = paramsRef.current.mode === 'pick'
  const decodeParam = (value?: string) => { try { return decodeURIComponent(value || '') } catch { return value || '' } }
  const [pickedPosition, setPickedPosition] = useState<LocationSelection | null>(null)
  const [searchQuery, setSearchQuery] = useState(decodeParam(paramsRef.current.query))
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [searchMessage, setSearchMessage] = useState('')
  const searchInFlightRef = useRef(false)
  const searchVersionRef = useRef(0)
  const cameraVersionRef = useRef(0)
  const touchedViewRef = useRef(false)
  const [locating, setLocating] = useState(false)
  const locatingRef = useRef(false)
  const locationCacheKey = `last-user-location:${authService.getCurrentUser()?.id || 'guest'}`
  const cachedUserLocation = () => {
    const cached = readLocationCache<UserLocation & { locatedAt: number }>(locationCacheKey)
    return cached && Date.now() - cached.locatedAt < 24 * 60 * 60 * 1000 ? cached : null
  }

  useEffect(() => () => {
    searchVersionRef.current += 1
    cameraVersionRef.current += 1
  }, [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pins, setPins] = useState<StreetliftingLocationMapPin[]>([])
  const [selectedPin, setSelectedPin] = useState<StreetliftingLocationMapPin | null>(null)
  const [center, setCenter] = useState<UserLocation>(DEFAULT_CENTER)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [observedScale, setObservedScale] = useState(DEFAULT_SCALE)
  const [hint, setHint] = useState('点一下聚合点可继续放大，点单个点位可查看详情并直接导航。')
  const moveMap = (view: LocationMapView, userAction = true) => {
    cameraVersionRef.current += 1
    if (userAction) touchedViewRef.current = true
    setCenter({ latitude: view.latitude, longitude: view.longitude })
    setScale(view.scale)
    setObservedScale(view.scale)
  }

  useEffect(() => {
    if (!ready) return
    const params = paramsRef.current
    void Taro.setNavigationBarTitle({ title: pickMode ? '选择单杠位置' : '单杠地图' })
    const request = pickMode ? readLocationCache<{ userId: string; initial: LocationDraft; nearby?: UserLocation | null }>(decodeParam(params.selectionKey)) : null
    const draft = request?.userId === authService.getCurrentUser()?.id ? request?.initial : null
    const latitude = params.latitude === undefined ? draft?.latitude ?? NaN : Number(params.latitude)
    const longitude = params.longitude === undefined ? draft?.longitude ?? NaN : Number(params.longitude)
    if (pickMode) {
      setLoading(false)
      setHint('搜索地点后，点击单杠的实际位置。确认后带回可获取的名称和地址，你可以修改或补充。')
      if (isValidLocationCoordinates(latitude, longitude)) {
        const initial: LocationSelection = { name: draft?.name || decodeParam(params.name), country: draft?.country || decodeParam(params.country), address: draft?.address || '', province: draft?.province || '', city: draft?.city || '', county: draft?.county || '', latitude, longitude, coordinate_system: (draft?.coordinate_system || params.coordinate_system) === 'wgs84' ? 'wgs84' : 'gcj02' }
        setPickedPosition(initial)
        const position = toWeChatCoordinates(initial)
        moveMap({ ...position, scale: 16 }, false)
      } else {
        const nearby = draft && request?.nearby
        if (nearby && isValidLocationCoordinates(nearby.latitude, nearby.longitude)) moveMap({ ...nearby, scale: FUZZY_PICK_SCALE }, false)
        else {
          moveMap(DEFAULT_LOCATION_MAP_VIEW, false)
          setHint('未能定位到你附近。可点击“定位我附近”重试，或搜索城市、公园和地址继续选点。')
        }
      }
      return
    }
    const decode = (value?: string) => { try { return decodeURIComponent(value || '') } catch { return value || '' } }
    const focus: StreetliftingLocationMapPin | null = isValidLocationCoordinates(latitude, longitude)
      ? { id: params.id || '__preview__', name: decode(params.name) || '所选位置', country: decode(params.country), latitude, longitude, coordinate_system: 'gcj02' }
      : null
    if (focus) {
      moveMap({ latitude, longitude, scale: 16 }, false)
      setSelectedPin(focus)
      setPins([focus])
      setHint(params.id ? '已定位到所选点位，可继续缩放查看附近。' : '这是经纬度位置预览，返回后可继续填写并保存。')
    }
    const applyPins = (data: StreetliftingLocationMapPin[]) => {
      const displayPins = data.filter((pin) => isValidLocationCoordinates(pin.latitude, pin.longitude)).map(toWeChatCoordinates)
      const visibleFocus = focus && (!equipmentFilter.length || displayPins.some(pin => pin.id === focus.id)) ? focus : null
      setPins(visibleFocus && !displayPins.some((pin) => pin.id === visibleFocus.id) ? [...displayPins, visibleFocus] : displayPins)
      if (focus) setSelectedPin(visibleFocus ? displayPins.find((pin) => pin.id === visibleFocus.id) || visibleFocus : null)
      else if (!touchedViewRef.current) moveMap(getInitialLocationMapView(displayPins, cachedUserLocation()), false)
    }
    const filters = { equipment: normalizeLocationEquipment(equipmentFilter), ...browseFilters }
    const cacheKey = `map-pins:equipment-v1:${JSON.stringify(filters)}`
    let cancelled = false
    const cached = readLocationCache<StreetliftingLocationMapPin[]>(cacheKey)
    if (!cached && !focus) setPins([])
    if (Array.isArray(cached)) applyPins(cached)
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await streetliftingIndexService.listLocationMapPins(filters)
        writeLocationCache(cacheKey, data || [])
        if (!cancelled) applyPins(data || [])
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || '地图点位加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [ready, params, equipmentFilter, browseFilters])

  useEffect(() => {
    if (!ready || pickMode || cachedUserLocation()) return
    let cancelled = false
    // Use only an existing permission. Opening the map never triggers a new
    // location prompt; the explicit locate button handles a first authorization.
    void (async () => {
      try {
        const setting = await Taro.getSetting()
        const scopes = setting.authSetting as Record<string, boolean | undefined>
        const res = scopes['scope.userFuzzyLocation']
          ? await getApproxUserLocation()
          : null
        if (!res || !isValidLocationCoordinates(res.latitude, res.longitude) || cancelled) return
        writeLocationCache(locationCacheKey, { latitude: res.latitude, longitude: res.longitude, locatedAt: Date.now() })
        const request = pickMode ? readLocationCache<{ initial: LocationDraft }>(decodeParam(params.selectionKey)) : null
        const hasInitialPoint = isValidLocationCoordinates(request?.initial?.latitude, request?.initial?.longitude)
        if (!touchedViewRef.current && params.latitude === undefined && !hasInitialPoint) moveMap({ latitude: res.latitude, longitude: res.longitude, scale: 13 }, false)
      } catch { /* No permission or provider failure: use populated regions. */ }
    })()
    return () => { cancelled = true }
  }, [ready, params])

  const clustered = useMemo(() => createClusterMarkers(pins, observedScale), [pins, observedScale])

  useEffect(() => {
    markerMetaRef.current = clustered.metaMap
  }, [clustered.metaMap])

  const handleMarkerTap = (event: any) => {
    const markerId = Number(event?.detail?.markerId)
    const meta = markerMetaRef.current.get(markerId)
    if (!meta) return

    if (meta.kind === 'cluster') {
      const nextScale = Math.min(observedScale + 2, 16)
      moveMap({ latitude: meta.latitude, longitude: meta.longitude, scale: nextScale })
      setSelectedPin(null)
      setHint(`已聚焦 ${meta.pins.length} 个点位，继续放大可以看到更细的分布。`)
      return
    }

    setSelectedPin(meta.pin)
    // Keep the user's current zoom when opening a point's details.
    setHint(`已选中 ${meta.pin.name}，可以直接打开系统地图导航。`)
  }

  const handleRegionChange = async (event: any) => {
    const detail = event?.detail || event
    const causedBy = detail?.causedBy || event?.causedBy
    if (!['gesture', 'drag', 'scale'].includes(causedBy)) return
    touchedViewRef.current = true
    const version = ++cameraVersionRef.current
    if ((detail?.type || event?.type) !== 'end') return
    const [nextScale, actualCenter] = await Promise.all([
      getGestureMapScale(event) ?? getCurrentScale(mapIdRef.current),
      getCurrentCenter(mapIdRef.current)
    ])
    // Only actual user gestures synchronize zoom. Programmatic callbacks and stale
    // readings are ignored, so a locate/search command cannot be undone by them.
    if (version === cameraVersionRef.current) {
      if (nextScale != null) {
        setObservedScale(nextScale)
        setScale(nextScale)
      }
      // Keep the controlled center aligned after a real pan. A later locate can
      // then move through props, without MapContext.moveToLocation's implicit
      // precise-location request in the simulator.
      if (actualCenter && isValidLocationCoordinates(actualCenter.latitude, actualCenter.longitude)) setCenter(actualCenter)
    }
  }

  const handleLocate = async () => {
    if (locatingRef.current) return
    locatingRef.current = true
    setLocating(true)
    const version = ++cameraVersionRef.current
    touchedViewRef.current = true
    try {
      const res = await getApproxUserLocation()
      if (!isValidLocationCoordinates(res.latitude, res.longitude)) throw new Error('未能获取有效位置')
      writeLocationCache(locationCacheKey, { ...res, locatedAt: Date.now() })
      if (version !== cameraVersionRef.current) return
      moveMap({ ...res, scale: pickMode ? FUZZY_PICK_SCALE : 13 })
      setHint(pickMode ? '已到你大致附近（微信只提供模糊定位）。请拖动地图找到单杠，点到具体位置再确认。' : '已定位到你附近。点击数字可展开周边单杠。')
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '定位失败', icon: 'none' })
    } finally {
      locatingRef.current = false
      setLocating(false)
    }
  }

  const handleResetView = () => {
    moveMap(pickMode ? getInitialLocationMapView([], cachedUserLocation()) : getInitialLocationMapView(pins))
    setSelectedPin(null)
    setHint(pickMode ? '搜索地名可到达国内外任意城市，再放大选点。' : '已显示单杠最多的区域。点击数字放大，或拖动地图浏览其他国家。')
  }

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (query.length < 2) { setSearchMessage('请输入城市、公园或地址，例如 Tokyo 或代々木公園。'); return }
    if (searchInFlightRef.current) return
    searchInFlightRef.current = true
    const version = ++searchVersionRef.current
    setSearching(true)
    const cacheKey = `search:local-names:${query.toLowerCase()}`
    const cached = readLocationCache<LocationSearchResult[]>(cacheKey)
    setSearchResults(Array.isArray(cached) ? cached : [])
    setSearchMessage('')
    try {
      const results = await streetliftingIndexService.searchPlaces(query)
      writeLocationCache(cacheKey, results)
      if (version !== searchVersionRef.current) return
      setSearchResults(results)
      if (!results.length) setSearchMessage('没有找到地点。可加上城市或国家名称再搜索，或直接拖动地图选点。')
    } catch (e) { if (version === searchVersionRef.current) setSearchMessage((e as Error)?.message || '搜索暂不可用，可直接在地图上选点。') }
    finally { searchInFlightRef.current = false; setSearching(false) }
  }

  const selectSearchResult = (result: LocationSearchResult) => {
    searchVersionRef.current += 1
    const position = toWeChatCoordinates(result)
    moveMap({ ...position, scale: result.zoom })
    setPickedPosition(result.zoom >= 14 ? usableSearchSelection(result) : null)
    setSearchResults([])
    setSearchMessage('')
    setHint(result.zoom >= 14 ? '已到达所选地点。可点击单杠的具体位置，或确认当前标记。' : '已到达目标区域。请放大地图，点击单杠的具体位置。')
  }

  const selectMapPoint = (latitude: number, longitude: number, name = '') => {
    if (!pickMode || !isValidLocationCoordinates(latitude, longitude)) return
    if (observedScale < 14) { Taro.showToast({ title: '请先放大地图，再选择具体位置', icon: 'none' }); return }
    const previous = pickedPosition && toWeChatCoordinates(pickedPosition)
    // Re-confirming a searched point must keep its original WGS84 coordinates.
    if (previous && Math.abs(previous.latitude - latitude) < 0.00005 && Math.abs(previous.longitude - longitude) < 0.00005) {
      // A map tap may arrive before its POI tap at the same coordinates.
      // Keep the search address/coordinate system, but retain the POI name too.
      if (name.trim()) setPickedPosition(current => current ? { ...current, name: name.trim() } : current)
      setHint('位置已选好，确认后带回可获取的名称和地址。')
      return
    }
    const selection: LocationSelection = { name, address: '', country: '', province: '', city: '', county: '', latitude, longitude, coordinate_system: 'gcj02' }
    setPickedPosition(selection)
    setHint(name ? '位置和地点名称已记录，确认后可补充详细地址。' : '位置已记录，未返回名称和地址，确认后请手动补充。')
  }

  const chooseMapCenter = async () => {
    const position = await getCurrentCenter(mapIdRef.current)
    if (position) selectMapPoint(position.latitude, position.longitude)
    else Taro.showToast({ title: '无法读取位置，请点击地图选点', icon: 'none' })
  }

  const confirmMapPosition = () => {
    if (!pickedPosition) { Taro.showToast({ title: '请先搜索地点或在地图上选点', icon: 'none' }); return }
    const key = decodeParam(paramsRef.current.selectionKey)
    const userId = authService.getCurrentUser()?.id || ''
    if (!key || !key.startsWith(`picker:${userId}:`)) { Taro.showToast({ title: '请从分享单杠入口选择位置', icon: 'none' }); return }
    writeLocationCache(key, { userId, position: pickedPosition })
    const saved = readLocationCache<{ position: LocationSelection }>(key)
    if (!saved || saved.position?.latitude !== pickedPosition.latitude || saved.position?.longitude !== pickedPosition.longitude) {
      Taro.showToast({ title: '暂时无法保存所选位置，请重试', icon: 'none' })
      return
    }
    void Taro.navigateBack().catch(() => Taro.showToast({ title: '返回失败，请点击左上角返回', icon: 'none' }))
  }

  const pickerMarker = pickedPosition ? [{ ...toWeChatCoordinates(pickedPosition), id: 1, iconPath: locationPinIcon, width: 32, height: 40, anchor: { x: 0.5, y: 1 } }] : []

  const handleBackToList = () => {
    Taro.navigateBack({
      fail: () => {
        Taro.redirectTo({ url: '/streetlifting/index/locations' })
      }
    })
  }

  const openSelectedPinInMap = () => {
    if (!selectedPin) return
    Taro.openLocation({
      latitude: selectedPin.latitude,
      longitude: selectedPin.longitude,
      name: selectedPin.name,
      address: formatAddress(selectedPin)
    }).catch(() => {
      Taro.showToast({ title: '打开地图失败', icon: 'none' })
    })
  }

  return (
    <View className={`locations-map-page theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
      <View className='locations-map-toolbar'>
        <View className='locations-map-btn' onClick={handleBackToList}>
          <Text>{pickMode ? '取消选点' : '返回列表'}</Text>
        </View>
        <View className='locations-map-btn' onClick={handleLocate}>
          <Text>{locating ? '定位中…' : '定位我附近'}</Text>
        </View>
        <View className='locations-map-btn primary' onClick={handleResetView}>
          <Text>{pickMode ? '起始区域' : '点位分布'}</Text>
        </View>
      </View>

      <View className='locations-map-summary'>
        <View className='locations-map-summary-main'>
          <Text className='locations-map-title'>{pickMode ? '标记单杠的实际位置' : '寻找附近的单杠'}</Text>
          <Text className='locations-map-desc'>{pickMode ? '先定位到你附近，搜索地点后确认单杠位置。能获取的信息自动带回，缺失或不准确的内容再修改。' : '优先显示你附近或单杠集中的地区。地图上的数字表示单杠数量。'}</Text>
        </View>
        {!pickMode && <View className='locations-map-stat'>
          <Text className='locations-map-stat-value'>{pins.length}</Text>
          <Text className='locations-map-stat-label'>地图点位</Text>
        </View>}
      </View>

      {pickMode && <View className='locations-map-search'>
        <View className='locations-map-search-row'>
          <Input className='locations-map-search-input' value={searchQuery} maxlength={160} placeholder='城市、公园或地址，例如 Tokyo' confirmType='search' onInput={(event) => setSearchQuery(event.detail.value)} onConfirm={handleSearch} />
          <View className='locations-map-btn primary search-places-btn' onClick={handleSearch}><Text>{searching ? '搜索中…' : '搜索'}</Text></View>
        </View>
        {searchMessage && <Text className='locations-map-search-message'>{searchMessage}</Text>}
        {searchResults.map((result) => <View key={result.id} className='locations-map-search-result' onClick={() => selectSearchResult(result)}>
          <Text className='locations-map-selected-title'>{result.name}</Text>
          <Text className='locations-map-selected-address'>{result.address}</Text>
        </View>)}
        <Text className='locations-map-search-attribution'>地点数据 © OpenStreetMap contributors · 搜索由 Photon 提供</Text>
      </View>}

      {!pickMode && <EquipmentSelector filter value={equipmentFilter} onChange={value => {
        touchedViewRef.current = true
        setSelectedPin(null)
        setEquipmentFilter(value)
        writeLocationCache('map-equipment-filter-return', { equipment: value, ...browseFilters })
      }} />}
      <View className='locations-map-container'>
        <TaroMap
          id={mapIdRef.current}
          className='locations-map'
          longitude={center.longitude}
          latitude={center.latitude}
          scale={scale}
          minScale={3}
          markers={(pickMode ? pickerMarker : clustered.markers) as any}
          showLocation={false}
          enableZoom
          enableScroll
          enableRotate={false}
          onError={() => setHint(pickMode ? '地图暂不可用，请稍后重试；也可通过搜索选择地点。' : '地图暂不可用，可返回列表继续查看已保存点位。')}
          onClick={(event: any) => selectMapPoint(event?.detail?.latitude, event?.detail?.longitude)}
          onPoiTap={(event) => selectMapPoint(event.detail.latitude, event.detail.longitude, event.detail.name)}
          onMarkerTap={handleMarkerTap}
          onRegionChange={handleRegionChange}
        />

        {!pickMode && <View className='locations-map-overlay'>
          <View>
            <Text className='locations-map-overlay-title'>点击数字放大，点击单杠查看</Text>
            <Text className='locations-map-overlay-desc'>支持拖动地图浏览国内外点位</Text>
          </View>
          <View className='locations-map-overlay-badge'>
            <Text>{selectedPin ? '已选中' : `${pins.length} 处`}</Text>
          </View>
        </View>}
      </View>

      {pickMode && <View className='locations-map-picker-confirm'>
        <Text className='locations-map-selected-title'>{pickedPosition ? pickedPosition.name || '已选地图位置' : '点击地图选择单杠位置'}</Text>
        {pickedPosition && <Text className='locations-map-selected-address'>{pickedPosition.address || '位置已记录，未返回详细地址，确认后请补充。'}</Text>}
        <View className='locations-map-selected-actions'>
          <View className='locations-map-btn select-map-center' onClick={chooseMapCenter}><Text>选取地图中心</Text></View>
          <View className={`locations-map-btn primary confirm-map-position${!pickedPosition ? ' disabled' : ''}`} onClick={confirmMapPosition}><Text>确认地图标记</Text></View>
        </View>
      </View>}

      {loading && (
        <View className='locations-map-loading'>
          <LoadingSpinner size={48} />
        </View>
      )}

      {!loading && error && (
        <View className='locations-map-error'>
          <Text>{error}</Text>
        </View>
      )}

      {selectedPin && (
        <View className='locations-map-selected'>
          <Text className='locations-map-selected-title'>{selectedPin.name}</Text>
          <Text className='locations-map-selected-area'>{formatArea(selectedPin)}</Text>
          <EquipmentTags location={selectedPin} />
          <Text className='locations-map-selected-address'>{selectedPin.address || '暂未补充详细地址'}</Text>
          <View className='locations-map-selected-actions'>
            <View className='locations-map-selected-btn' onClick={() => setSelectedPin(null)}>
              <Text>取消选中</Text>
            </View>
            <View className='locations-map-selected-btn primary' onClick={openSelectedPinInMap}>
              <Text>打开系统地图</Text>
            </View>
          </View>
        </View>
      )}

      <View className='locations-map-hint'>
        <Text>{hint}</Text>
      </View>
    </View>
  )
}
