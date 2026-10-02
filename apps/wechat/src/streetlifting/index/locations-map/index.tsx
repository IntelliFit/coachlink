import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Input, Map as TaroMap } from '@tarojs/components'
import Taro from '@tarojs/taro'

import {
  streetliftingIndexService,
  type StreetliftingLocationMapPin
} from '@/services/streetliftingIndexService'
import locationClusterIcon from '@/assets/map/location-cluster.png'
import locationPinIcon from '@/assets/map/location-pin.png'
import { LoadingSpinner } from '@/components/LoadingSpinner'

import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { isValidLocationCoordinates, toWeChatCoordinates, type LocationSelection, type LocationSearchResult } from '@coachlink/core'
import { readLocationCache, writeLocationCache } from '@/utils/streetliftingLocationCache'

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

async function getApproxUserLocation(): Promise<UserLocation> {
  const taroWithFuzzyLocation = Taro as typeof Taro & {
    getFuzzyLocation?: (options?: { type?: string }) => Promise<UserLocation>
  }
  if (typeof taroWithFuzzyLocation.getFuzzyLocation === 'function') {
    const location = await taroWithFuzzyLocation.getFuzzyLocation({ type: 'gcj02' })
    return { latitude: location.latitude, longitude: location.longitude }
  }

  const location = await Taro.getLocation({ type: 'gcj02' })
  return { latitude: location.latitude, longitude: location.longitude }
}

const DEFAULT_CENTER = {
  latitude: 20,
  longitude: 0
}

const DEFAULT_SCALE = 3
const MAX_CLUSTER_LABEL_COUNT = 99
const CLUSTER_ID_BASE = 100000

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

function getCurrentScale(mapId: string): Promise<number> {
  const ctx = getMapContext(mapId)
  return new Promise((resolve) => {
    ctx.getScale({
      success: (res: any) => resolve(Number(res?.scale || DEFAULT_SCALE)),
      fail: () => resolve(DEFAULT_SCALE)
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
  const paramsRef = useRef(Taro.getCurrentInstance().router?.params || {})
  const pickMode = paramsRef.current.mode === 'pick'
  const decodeParam = (value?: string) => { try { return decodeURIComponent(value || '') } catch { return value || '' } }
  const [pickedPosition, setPickedPosition] = useState<LocationSelection | null>(null)
  const [searchQuery, setSearchQuery] = useState(decodeParam(paramsRef.current.query))
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([])
  const [searchMessage, setSearchMessage] = useState('')
  const searchInFlightRef = useRef(false)
  const searchVersionRef = useRef(0)

  useEffect(() => () => { searchVersionRef.current += 1 }, [])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pins, setPins] = useState<StreetliftingLocationMapPin[]>([])
  const [selectedPin, setSelectedPin] = useState<StreetliftingLocationMapPin | null>(null)
  const [center, setCenter] = useState<UserLocation>(DEFAULT_CENTER)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [hint, setHint] = useState('点一下聚合点可继续放大，点单个点位可查看详情并直接导航。')

  useEffect(() => {
    const params = paramsRef.current
    const latitude = params.latitude === undefined ? NaN : Number(params.latitude)
    const longitude = params.longitude === undefined ? NaN : Number(params.longitude)
    if (pickMode) {
      setLoading(false)
      setHint('搜索城市、公园或地址后，在地图上点到单杠的具体位置，再确认。也可直接拖动地图选点。')
      if (isValidLocationCoordinates(latitude, longitude)) {
        const initial: LocationSelection = { name: decodeParam(params.name), country: decodeParam(params.country), address: '', province: '', city: '', county: '', latitude, longitude, coordinate_system: params.coordinate_system === 'wgs84' ? 'wgs84' : 'gcj02' }
        setPickedPosition(initial)
        const position = toWeChatCoordinates(initial)
        setCenter({ latitude: position.latitude, longitude: position.longitude })
        setScale(16)
      }
      return
    }
    const decode = (value?: string) => { try { return decodeURIComponent(value || '') } catch { return value || '' } }
    const focus: StreetliftingLocationMapPin | null = isValidLocationCoordinates(latitude, longitude)
      ? { id: params.id || '__preview__', name: decode(params.name) || '所选位置', country: decode(params.country), latitude, longitude, coordinate_system: 'gcj02' }
      : null
    if (focus) {
      setCenter({ latitude, longitude })
      setScale(16)
      setSelectedPin(focus)
      setPins([focus])
      setHint(params.id ? '已定位到所选点位，可继续缩放查看附近。' : '这是经纬度位置预览，返回后可继续填写并保存。')
    }
    const applyPins = (data: StreetliftingLocationMapPin[]) => {
      const displayPins = data.filter((pin) => isValidLocationCoordinates(pin.latitude, pin.longitude)).map(toWeChatCoordinates)
      setPins(focus && !displayPins.some((pin) => pin.id === focus.id) ? [...displayPins, focus] : displayPins)
      if (focus) setSelectedPin(displayPins.find((pin) => pin.id === focus.id) || focus)
    }
    const cached = readLocationCache<StreetliftingLocationMapPin[]>('map-pins')
    if (Array.isArray(cached)) applyPins(cached)
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await streetliftingIndexService.listLocationMapPins()
        writeLocationCache('map-pins', data || [])
        applyPins(data || [])
      } catch (e) {
        setError((e as Error)?.message || '地图点位加载失败')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const clustered = useMemo(() => createClusterMarkers(pins, scale), [pins, scale])

  useEffect(() => {
    markerMetaRef.current = clustered.metaMap
  }, [clustered.metaMap])

  const handleMarkerTap = (event: any) => {
    const markerId = Number(event?.detail?.markerId)
    const meta = markerMetaRef.current.get(markerId)
    if (!meta) return

    if (meta.kind === 'cluster') {
      const nextScale = Math.min(scale + 2, 16)
      setCenter({ latitude: meta.latitude, longitude: meta.longitude })
      setScale(nextScale)
      setSelectedPin(null)
      setHint(`已聚焦 ${meta.pins.length} 个点位，继续放大可以看到更细的分布。`)
      return
    }

    setSelectedPin(meta.pin)
    setCenter({ latitude: meta.pin.latitude, longitude: meta.pin.longitude })
    setHint(`已选中 ${meta.pin.name}，可以直接打开系统地图导航。`)
  }

  const handleRegionChange = async (event: any) => {
    if (event?.type !== 'end' && event?.detail?.type !== 'end') return
    const [nextScale, nextCenter] = await Promise.all([
      getCurrentScale(mapIdRef.current),
      getCurrentCenter(mapIdRef.current)
    ])
    setScale(nextScale)
    if (nextCenter) setCenter(nextCenter)
  }

  const handleLocate = async () => {
    try {
      const res = await getApproxUserLocation()
      setCenter({ latitude: res.latitude, longitude: res.longitude })
      setScale(13)
      setHint('已定位到你附近，继续缩放可以查看周边更细的单杠分布。')
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '定位失败', icon: 'none' })
    }
  }

  const handleResetView = () => {
    setCenter(DEFAULT_CENTER)
    setScale(DEFAULT_SCALE)
    setSelectedPin(null)
    setHint(pickMode ? '已回到世界视角。搜索地名可快速到达目标区域，已选位置仍保留。' : '已回到世界视角，拖动和放大地图可以浏览不同国家的单杠点位。')
  }

  const handleSearch = async () => {
    const query = searchQuery.trim()
    if (query.length < 2) { setSearchMessage('请输入城市、公园或地址，例如 Tokyo 或代々木公園。'); return }
    if (searchInFlightRef.current) return
    searchInFlightRef.current = true
    const version = ++searchVersionRef.current
    setSearching(true)
    const cacheKey = `search:${query.toLowerCase()}`
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
    setCenter({ latitude: position.latitude, longitude: position.longitude })
    setScale(result.zoom)
    setPickedPosition(result)
    setSearchResults([])
    setSearchMessage('')
    setHint('已到达所选地点。可放大后点击单杠的具体位置，或直接确认此处。')
  }

  const selectMapPoint = (latitude: number, longitude: number, name = '') => {
    if (!pickMode || !isValidLocationCoordinates(latitude, longitude)) return
    setPickedPosition((prev) => ({ name, address: '', country: prev?.country || decodeParam(paramsRef.current.country), province: prev?.province || '', city: prev?.city || '', county: prev?.county || '', latitude, longitude, coordinate_system: 'gcj02' }))
    setHint('已选中地图位置，确认后将自动带回添加表单。国家和地址可在表单中补充。')
  }

  const chooseMapCenter = async () => {
    const position = await getCurrentCenter(mapIdRef.current)
    if (position) selectMapPoint(position.latitude, position.longitude)
    else Taro.showToast({ title: '无法读取位置，请点击地图选点', icon: 'none' })
  }

  const confirmMapPosition = () => {
    if (!pickedPosition) { Taro.showToast({ title: '请先搜索地点或在地图上选点', icon: 'none' }); return }
    const channel = (Taro.getCurrentInstance().page as any)?.getOpenerEventChannel?.()
    if (!channel?.emit) { Taro.showToast({ title: '请从添加单杠页面重新选点', icon: 'none' }); return }
    channel.emit('streetliftingLocationSelected', pickedPosition)
    void Taro.navigateBack()
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
    <View className={`locations-map-page theme-${effectiveTheme}`}>
      <View className='locations-map-toolbar'>
        <View className='locations-map-btn' onClick={handleBackToList}>
          <Text>{pickMode ? '返回表单' : '返回列表'}</Text>
        </View>
        <View className='locations-map-btn' onClick={handleLocate}>
          <Text>定位我附近</Text>
        </View>
        <View className='locations-map-btn primary' onClick={handleResetView}>
          <Text>世界视角</Text>
        </View>
      </View>

      <View className='locations-map-summary'>
        <View className='locations-map-summary-main'>
          <Text className='locations-map-title'>{pickMode ? '搜索地点 / 地图选点' : '单杠地图模式'}</Text>
          <Text className='locations-map-desc'>{pickMode ? '搜索后点击具体位置，坐标会自动填写，无需手动输入。' : '浏览国内外单杠点位，支持聚合查看、经纬度定位和系统地图导航。'}</Text>
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
            <Text className='locations-map-overlay-title'>国内外点位分布</Text>
            <Text className='locations-map-overlay-desc'>当前缩放 {scale} 级，已渲染 {clustered.markers.length} 个地图标记</Text>
          </View>
          <View className='locations-map-overlay-badge'>
            <Text>{selectedPin ? '已选中点位' : '聚合已开启'}</Text>
          </View>
        </View>}
      </View>

      {pickMode && <View className='locations-map-picker-confirm'>
        <Text className='locations-map-selected-title'>{pickedPosition ? pickedPosition.name || '已选地图位置' : '点击地图选择单杠位置'}</Text>
        {pickedPosition && <Text className='locations-map-selected-address'>{pickedPosition.address || '坐标已自动记录，可在表单中补充地址。'}</Text>}
        <View className='locations-map-selected-actions'>
          <View className='locations-map-btn select-map-center' onClick={chooseMapCenter}><Text>选取地图中心</Text></View>
          <View className='locations-map-btn primary confirm-map-position' onClick={confirmMapPosition}><Text>确认此位置</Text></View>
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
