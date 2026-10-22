import { useEffect, useMemo, useState } from 'react'
import { usePageEnterTrace } from '@/utils/pageTrace'
import { View, Text, ScrollView, Image, Button } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import {
  streetliftingIndexService,
  type StreetliftingLocation
} from '@/services/streetliftingIndexService'
import {
  buildSharePath,
  buildStreetliftingLocationShareImageUrl,
  buildStreetliftingLocationSharePath,
  createSharePayload,
  createTimelinePayload,
  getStreetliftingLocationShareTitle,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

function getLocationImages(loc?: Partial<StreetliftingLocation> | null): string[] {
  if (Array.isArray(loc?.image_urls) && loc?.image_urls.length) return loc.image_urls
  if (loc?.image_url) return [loc.image_url]
  return []
}

function parseScene(rawScene: unknown) {
  const scene = decodeURIComponent(String(rawScene || '').trim())
  // scene 可能是旧格式 lid=xxx 或新格式 32 位纯字符串（去掉 - 的 UUID）
  let id = scene.replace(/^lid=/, '')
  // 如果是 32 位纯字符串，还原为带 - 的 UUID
  if (id.length === 32 && !id.includes('-')) {
    id = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
  }
  return {
    locationId: id
  }
}

function buildPreviewLocation(params: Record<string, unknown>): StreetliftingLocation | null {
  const scene = parseScene(params.scene)
  const locationId = String(params.locationId || scene.locationId || '').trim()
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
    id: locationId || `preview-${name || 'location'}`,
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

function getSharePath(loc?: Partial<StreetliftingLocation> | null) {
  const locationId = String(loc?.id || '').trim()
  if (!locationId) return buildStreetliftingLocationSharePath()
  return buildSharePath('/streetlifting/index/location-share', { locationId })
}

function formatContributor(loc?: Partial<StreetliftingLocation> | null) {
  const raw = String(loc?.contributor_name_snapshot || loc?.user_contact || '').trim()
  return raw ? `贡献者：${raw}` : ''
}

function buildAreaLine(loc?: Partial<StreetliftingLocation> | null) {
  return [loc?.province, loc?.city, loc?.county, loc?.address].filter(Boolean).join(' ')
}

function buildMetaLine(loc?: Partial<StreetliftingLocation> | null) {
  return [loc?.province, loc?.city, loc?.county].filter(Boolean).join(' · ')
}

export default function StreetliftingLocationSharePage() {
  usePageEnterTrace()

  const { effectiveTheme } = useTheme()
  const routerParams = (Taro.getCurrentInstance().router?.params || {}) as Record<string, unknown>
  const previewLocation = useMemo(() => buildPreviewLocation(routerParams), [])
  const scene = parseScene(routerParams.scene)
  const locationId = String(routerParams.locationId || scene.locationId || '').trim()
  const [loading, setLoading] = useState(Boolean(locationId))
  const [location, setLocation] = useState<StreetliftingLocation | null>(previewLocation)

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    const currentName = String(location?.name || previewLocation?.name || '').trim()
    Taro.setNavigationBarTitle({
      title: currentName || '单杠点位'
    }).catch(() => {
      // ignore
    })
  }, [location, previewLocation])

  useEffect(() => {
    if (!locationId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void streetliftingIndexService
      .getLocation(locationId)
      .then((data) => {
        if (!cancelled) setLocation(data)
      })
      .catch((error) => {
        console.error('[location-share] getLocation failed', error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locationId])

  const sharePayload = useMemo(() => {
    const target = location || previewLocation
    const areaName = [target?.city, target?.province].filter(Boolean).join(' ')
    const posterArea = buildAreaLine(target)
    return createSharePayload({
      title: getStreetliftingLocationShareTitle(target?.name, areaName),
      path: getSharePath(target),
      imageUrl: buildStreetliftingLocationShareImageUrl({
        id: target?.id,
        name: target?.name,
        area: posterArea || areaName,
        description: target?.description,
        imageUrl: getLocationImages(target)[0]
      })
    })
  }, [location, previewLocation])

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  const openMap = () => {
    if (!location || location.latitude == null || location.longitude == null) return
    Taro.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
      address: buildAreaLine(location)
    }).catch(() => {
      Taro.showToast({ title: '打开地图失败', icon: 'none' })
    })
  }

  const openList = () => {
    Taro.navigateTo({
      url: '/streetlifting/index/locations'
    })
  }

  const current = location || previewLocation
  const images = getLocationImages(current)
  const metaLine = buildMetaLine(current)
  const contributorLine = formatContributor(current)

  return (
    <View className={`location-share-page theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`}>
      <ScrollView className='location-share-scroll' scrollY>
        <View className='location-share-content'>
          {loading ? (
            <View className='location-share-loading'>
              <LoadingSpinner size={48} />
            </View>
          ) : current ? (
            <View className='location-share-card'>
              <View className='location-share-cover-wrap'>
                {images[0] ? (
                  <Image className='location-share-cover' src={images[0]} mode='aspectFill' />
                ) : (
                  <View className='location-share-cover-empty'>
                    <Text>暂时还没有现场图片</Text>
                  </View>
                )}
                {images.length > 0 && (
                  <View className='location-share-cover-count'>
                    <Text>{images.length} 张图</Text>
                  </View>
                )}
              </View>

              <View className='location-share-body'>
                <Text className='location-share-eyebrow'>来自好友分享</Text>
                <Text className='location-share-name'>{current.name}</Text>
                {current.address ? <Text className='location-share-address'>{current.address}</Text> : null}
                <Text className='location-share-meta'>
                  {metaLine || '单杠地图点位'}
                </Text>
                {!!contributorLine && (
                  <Text className='location-share-contributor'>{contributorLine}</Text>
                )}
                <Text className='location-share-desc'>
                  {String(current.description || '这个点位暂时还没有更多介绍，你可以进入 CoachLink 查看地图、图片和附近更多单杠点位。').trim()}
                </Text>

                <View className='location-share-actions'>
                  {current.latitude != null && current.longitude != null ? (
                    <Button className='location-share-btn location-share-btn-primary' onClick={openMap}>
                      查看地图
                    </Button>
                  ) : (
                    <Button className='location-share-btn location-share-btn-primary' onClick={openList}>
                      去单杠地图
                    </Button>
                  )}
                  <Button className='location-share-btn location-share-btn-secondary' onClick={openList}>
                    查看更多点位
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            <View className='location-share-empty'>
              <Text className='location-share-empty-title'>未找到这个单杠点位</Text>
              <Text className='location-share-empty-text'>
                这个分享可能已经失效，或者点位信息已经调整。你可以返回单杠地图继续查看其他点位。
              </Text>
              <Button className='location-share-btn location-share-btn-primary' onClick={openList}>
                去单杠地图
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
