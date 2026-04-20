import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Map as TaroMap } from '@tarojs/components'
import Taro from '@tarojs/taro'

import {
  streetliftingIndexService,
  type StreetliftingLocationMapPin
} from '@/services/streetliftingIndexService'
import locationClusterIcon from '@/assets/map/location-cluster.png'
import locationPinIcon from '@/assets/map/location-pin.png'
import { LoadingSpinner } from '@/components/LoadingSpinner'

import './index.scss'

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
  latitude: 35.0,
  longitude: 105.0
}

const DEFAULT_SCALE = 4
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
  return [pin.province, pin.city, pin.county].filter(Boolean).join(' · ') || '未补充区域信息'
}

function formatAddress(pin: StreetliftingLocationMapPin): string {
  return [pin.province, pin.city, pin.county, pin.address].filter(Boolean).join(' ')
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
  const mapIdRef = useRef(`streetlifting-map-${Date.now()}`)
  const markerMetaRef = useRef(new globalThis.Map<number, ClusterMarkerMeta>())

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pins, setPins] = useState<StreetliftingLocationMapPin[]>([])
  const [selectedPin, setSelectedPin] = useState<StreetliftingLocationMapPin | null>(null)
  const [center, setCenter] = useState<UserLocation>(DEFAULT_CENTER)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [hint, setHint] = useState('点一下聚合点可继续放大，点单个点位可查看详情并直接导航。')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await streetliftingIndexService.listLocationMapPins()
        setPins(data || [])
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
    if (event?.type !== 'end') return
    const [nextScale, nextCenter] = await Promise.all([
      getCurrentScale(mapIdRef.current),
      getCurrentCenter(mapIdRef.current)
    ])
    setScale(nextScale)
    if (nextCenter) setCenter(nextCenter)
  }

  const handleLocate = async () => {
    try {
      const res = await Taro.getLocation({ type: 'gcj02' })
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
    setHint('已回到全国视角，你可以先看整体分布，再放大到所在城市。')
  }

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
    <View className='locations-map-page'>
      <View className='locations-map-toolbar'>
        <View className='locations-map-btn' onClick={handleBackToList}>
          <Text>返回列表</Text>
        </View>
        <View className='locations-map-btn' onClick={handleLocate}>
          <Text>定位我附近</Text>
        </View>
        <View className='locations-map-btn primary' onClick={handleResetView}>
          <Text>全国视角</Text>
        </View>
      </View>

      <View className='locations-map-summary'>
        <View className='locations-map-summary-main'>
          <Text className='locations-map-title'>单杠地图模式</Text>
          <Text className='locations-map-desc'>把网站上的全国点位地图搬到小程序里，支持聚合查看、放大浏览和系统地图导航。</Text>
        </View>
        <View className='locations-map-stat'>
          <Text className='locations-map-stat-value'>{pins.length}</Text>
          <Text className='locations-map-stat-label'>地图点位</Text>
        </View>
      </View>

      <View className='locations-map-container'>
        <TaroMap
          id={mapIdRef.current}
          className='locations-map'
          longitude={center.longitude}
          latitude={center.latitude}
          scale={scale}
          markers={clustered.markers as any}
          showLocation
          enableZoom
          enableScroll
          enableRotate={false}
          onMarkerTap={handleMarkerTap}
          onRegionChange={handleRegionChange}
        />

        <View className='locations-map-overlay'>
          <View>
            <Text className='locations-map-overlay-title'>全国分布</Text>
            <Text className='locations-map-overlay-desc'>当前缩放 {scale} 级，已渲染 {clustered.markers.length} 个地图标记</Text>
          </View>
          <View className='locations-map-overlay-badge'>
            <Text>{selectedPin ? '已选中点位' : '聚合已开启'}</Text>
          </View>
        </View>
      </View>

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
