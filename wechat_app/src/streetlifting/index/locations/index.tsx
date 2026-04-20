/**
 * 单杠位置 - 小程序原生实现（列表、筛选、新增/编辑、图片上传）
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Input, Picker, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  streetliftingIndexService,
  type StreetliftingLocationContributor,
  type StreetliftingLocationOverviewStats,
  type StreetliftingLocation,
  type StreetliftingLocationMapPin
} from '@/services/streetliftingIndexService'
import { authService } from '@/services/authService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const MAX_IMAGES = 4
const PAGE_SIZE = 20

type UserLocation = {
  latitude: number
  longitude: number
}

type NearbyLocation = StreetliftingLocationMapPin & {
  distanceKm: number
}

function getLocationImages(loc: StreetliftingLocation): string[] {
  if (loc.image_urls?.length) return loc.image_urls
  if (loc.image_url) return [loc.image_url]
  return []
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

export default function StreetliftingLocations() {
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<StreetliftingLocation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [provinces, setProvinces] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [province, setProvince] = useState('all')
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
  const requestIdRef = useRef(0)
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
    latitude: null as number | null,
    longitude: null as number | null
  })
  const [imageUrls, setImageUrls] = useState<string[]>([])

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
    setLoading(true)
    try {
      const data = await streetliftingIndexService.listLocations({
        page: targetPage,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        province: province === 'all' ? undefined : province
      })

      if (currentRequestId !== requestIdRef.current) return

      const nextLocations = sortLocations(data?.locations || [])
      setLocations((prev) => (append ? [...prev, ...nextLocations] : nextLocations))
      setTotal(data?.pagination?.total ?? nextLocations.length)
      setPage(targetPage)
      if (data?.provinces?.length) setProvinces(data.provinces)
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
    if (firstFilterEffectRef.current) {
      firstFilterEffectRef.current = false
      return
    }
    const t = setTimeout(() => {
      fetchLocations(1, false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, province])

  const resetForm = () => {
    setEditing(null)
    setForm({ name: '', description: '', address: '', city: '', province: '', county: '', latitude: null, longitude: null })
    setImageUrls([])
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (loc: StreetliftingLocation) => {
    const imgs = getLocationImages(loc)
    setEditing(loc)
    setForm({
      name: loc.name,
      description: loc.description || '',
      address: loc.address || '',
      city: loc.city || '',
      province: loc.province || '',
      county: loc.county || '',
      latitude: loc.latitude ?? null,
      longitude: loc.longitude ?? null
    })
    setImageUrls(imgs)
    setDialogOpen(true)
  }

  const chooseLocation = async () => {
    try {
      const result = await Taro.chooseLocation()
      setForm((prev) => ({
        ...prev,
        name: prev.name || result.name || '',
        address: result.address || prev.address,
        latitude: typeof result.latitude === 'number' ? result.latitude : prev.latitude,
        longitude: typeof result.longitude === 'number' ? result.longitude : prev.longitude
      }))
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '选点失败', icon: 'none' })
    }
  }

  const removeImage = (index: number) => {
    setImageUrls((p) => p.filter((_, i) => i !== index))
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
    setSubmitting(true)
    try {
      if (editing) {
        await streetliftingIndexService.updateLocation({
          id: editing.id,
          name: form.name.trim(),
          description: form.description || null,
          address: form.address || null,
          city: form.city || null,
          province: form.province || null,
          county: form.county || null,
          latitude: form.latitude,
          longitude: form.longitude,
          image_urls: imageUrls.length ? imageUrls : null
        })
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        await streetliftingIndexService.createLocation({
          name: form.name.trim(),
          description: form.description || null,
          address: form.address || null,
          city: form.city || null,
          province: form.province || null,
          county: form.county || null,
          latitude: form.latitude,
          longitude: form.longitude,
          image_urls: imageUrls.length ? imageUrls : null,
          user_contact: getCurrentContributorContact()
        })
        Taro.showToast({ title: '提交成功', icon: 'success' })
      }
      setDialogOpen(false)
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

  const handleShare = (loc: StreetliftingLocation) => {
    const addressPart = [loc.province, loc.city, loc.county, loc.address].filter(Boolean).join(' ')
    const text = `发现单杠训练点：${loc.name}\n${addressPart || '暂无详细地址'}\n${loc.description ? `${loc.description}\n` : ''}`
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: '已复制到剪贴板', icon: 'success' })
    })
  }

  const openLocationInMap = (loc: { name: string; latitude: number; longitude: number; address?: string | null }) => {
    Taro.openLocation({
      latitude: loc.latitude,
      longitude: loc.longitude,
      name: loc.name,
      address: loc.address || ''
    }).catch(() => {
      Taro.showToast({ title: '打开地图失败', icon: 'none' })
    })
  }

  const ensureMapPins = async () => {
    if (mapPins.length > 0) return mapPins
    setLoadingMapPins(true)
    try {
      const pins = await streetliftingIndexService.listLocationMapPins()
      setMapPins(pins)
      return pins
    } finally {
      setLoadingMapPins(false)
    }
  }

  const handleLocateNearby = async () => {
    setLocating(true)
    try {
      const location = await Taro.getLocation({ type: 'gcj02' })
      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude
      })
      await ensureMapPins()
      Taro.showToast({ title: '已获取当前位置', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: (e as Error)?.message || '定位失败', icon: 'none' })
    } finally {
      setLocating(false)
    }
  }

  const handleOpenMapMode = () => {
    Taro.navigateTo({
      url: '/streetlifting/index/locations-map'
    }).catch(() => {
      Taro.showToast({ title: '打开地图失败', icon: 'none' })
    })
  }

  const nearbyLocations = useMemo<NearbyLocation[]>(() => {
    if (!userLocation || mapPins.length === 0) return []
    return [...mapPins]
      .map((pin) => ({
        ...pin,
        distanceKm: calculateDistanceKm(userLocation, {
          latitude: pin.latitude,
          longitude: pin.longitude
        })
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5)
  }, [mapPins, userLocation])

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
    <View className='loc-page'>
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
          <View className='loc-tab-panel'>
            <View className='loc-toolbar'>
              <Input
                className='search-input'
                placeholder='搜索名称/省市/地址'
                value={search}
                onInput={(e) => setSearch(e.detail.value)}
              />
              <Picker
                mode='selector'
                range={['全部省份', ...provinces]}
                value={province === 'all' ? 0 : Math.max(0, provinces.indexOf(province) + 1)}
                onChange={(e) => {
                  const i = Number(e.detail.value)
                  setProvince(i === 0 ? 'all' : (provinces[i - 1] || 'all'))
                }}
              >
                <View className='picker-province'>{province === 'all' ? '全部省份' : province}</View>
              </Picker>
            </View>

            <ScrollView
              className='loc-scroll'
              scrollY
              onScrollToLower={loadMore}
              lowerThreshold={100}
            >
              {loading && locations.length === 0 ? (
                renderSkeleton()
              ) : locations.length === 0 ? (
                <View className='empty-wrap'>
                  <Text>暂无地点信息</Text>
                  <Text className='empty-hint'>成为第一个分享者吧</Text>
                </View>
              ) : (
                <View className='loc-list'>
                  {locations.map((loc) => (
                    <View key={loc.id} className='loc-card'>
                      <View className='loc-card-image-wrap'>
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
                            <Text>{getLocationImages(loc).length} 张图</Text>
                          </View>
                        )}
                        <View className='loc-card-img-share' onClick={() => handleShare(loc)}>
                          <Text className='iconfont icon-share' />
                        </View>
                      </View>
                      <View className='loc-card-body'>
                        <View className='loc-card-title-row'>
                          <Text className='loc-card-name' numberOfLines={1}>{loc.name}</Text>
                          {loc.latitude != null && loc.longitude != null && (
                            <View
                              className='loc-card-map-btn'
                              onClick={() => openLocationInMap({
                                name: loc.name,
                                latitude: loc.latitude as number,
                                longitude: loc.longitude as number,
                                address: [loc.province, loc.city, loc.county, loc.address].filter(Boolean).join(' ')
                              })}
                            >
                              <Text className='iconfont icon-location' />
                              <Text className='loc-card-map-text'>查看地图</Text>
                            </View>
                          )}
                        </View>
                        <View className='loc-card-meta-list'>
                          <Text className='loc-card-meta-item'>
                            {[loc.province, loc.city, loc.county].filter(Boolean).join(' · ')}
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
            </ScrollView>
          </View>
        )}

        {/* --- Tab 1: 单杠数据 --- */}
        {activeTab === 1 && (
          <ScrollView className='loc-tab-panel-scroll' scrollY>
            <View className='loc-data-section'>
              <View className='loc-header compact'>
                <View className='loc-header-actions'>
                  <View className='loc-summary-secondary loc-summary-half' onClick={handleOpenMapMode}>
                    <Text className='iconfont icon-location' />
                    <Text>全国地图</Text>
                  </View>
                  <View className='loc-summary-action loc-summary-half' onClick={handleLocateNearby}>
                    <Text>{locating ? '定位中…' : '定位我附近'}</Text>
                  </View>
                </View>
              </View>

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
                      <View key={item.id} className='nearby-item'>
                        <View className='nearby-item-main'>
                          <Text className='nearby-name'>{item.name}</Text>
                          <Text className='nearby-distance'>{item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)}m` : `${item.distanceKm.toFixed(1)}km`}</Text>
                        </View>
                        <View className='nearby-map-btn' onClick={() => openLocationInMap(item)}>
                          <Text className='iconfont icon-location' />
                          <Text>地图查看</Text>
                        </View>
                      </View>
                    ))}
                  </View>
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

      {/* ===== 表单弹窗 ===== */}
      {dialogOpen && (
        <View className='dialog-mask' onClick={() => { setDialogOpen(false); resetForm() }}>
          <View className='dialog-box' onClick={(e) => e.stopPropagation()}>
            <Text className='dialog-title'>{editing ? '编辑单杠位置' : '分享单杠位置'}</Text>
            <ScrollView scrollY className='dialog-scroll'>
              <View className='form-row'>
                <Text className='label'>地点名称 *</Text>
                <Input
                  className='input'
                  placeholder='例如：朝阳公园健身区'
                  value={form.name}
                  onInput={(e) => setForm((p) => ({ ...p, name: e.detail.value }))}
                />
              </View>
              <View className='form-row'>
                <Text className='label'>省份</Text>
                <Input className='input' placeholder='例如：北京市' value={form.province} onInput={(e) => setForm((p) => ({ ...p, province: e.detail.value }))} />
              </View>
              <View className='form-row'>
                <Text className='label'>城市/区</Text>
                <Input className='input' placeholder='例如：朝阳区' value={form.city} onInput={(e) => setForm((p) => ({ ...p, city: e.detail.value }))} />
              </View>
              <View className='form-row'>
                <Text className='label'>区县</Text>
                <Input className='input' placeholder='例如：望京街道' value={form.county} onInput={(e) => setForm((p) => ({ ...p, county: e.detail.value }))} />
              </View>
              <View className='form-row'>
                <Text className='label'>详细地址</Text>
                <Input className='input' placeholder='例如：东门进来右手边' value={form.address} onInput={(e) => setForm((p) => ({ ...p, address: e.detail.value }))} />
              </View>
              <View className='form-row'>
                <Text className='label'>地图位置</Text>
                <View className='location-picker-row'>
                  <View className='location-picker-value'>
                    <Text>{form.latitude != null && form.longitude != null ? '已选地图位置' : '未选择地图位置'}</Text>
                  </View>
                  <View className='location-picker-btn' onClick={chooseLocation}>
                    <Text>选择位置</Text>
                  </View>
                </View>
              </View>
              <View className='form-row'>
                <Text className='label'>描述</Text>
                <Input className='input' placeholder='单杠高度/数量/手感…' value={form.description} onInput={(e) => setForm((p) => ({ ...p, description: e.detail.value }))} />
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
            </ScrollView>
            <View className='dialog-actions'>
              <Button className='btn-cancel' onClick={() => { setDialogOpen(false); resetForm() }}>取消</Button>
              <Button className='btn-ok' onClick={handleSubmit} disabled={submitting}>{editing ? '保存' : '提交'}</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
