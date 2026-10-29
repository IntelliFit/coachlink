/**
 * 我的点位：当前登录用户上传过的单杠点位、贡献排名，以及每个点位还缺什么。
 * 编辑和新增复用单杠地图页的表单（?edit=<id>&from=mine / ?create=1&from=mine），保存后自动返回本页。
 */
import { useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { LOCATION_GAP_LABELS, isValidLocationCoordinates, toWeChatCoordinates } from '@coachlink/core'
import {
  streetliftingIndexService,
  type StreetliftingMyLocation,
  type StreetliftingMyLocationsResult
} from '@/services/streetliftingIndexService'
import { authService } from '@/services/authService'
import { EquipmentTags } from '@/components/LocationEquipment'
import { readLocationCache, writeLocationCache } from '@/utils/streetliftingLocationCache'
import { usePageEnterTrace } from '@/utils/pageTrace'
import { useTheme } from '@/hooks/useTheme'
import './index.scss'

type Filter = 'all' | 'gaps'

const PAGE_ROUTE = '/streetlifting/index/my-locations'

function getImages(loc: StreetliftingMyLocation): string[] {
  if (loc.image_urls?.length) return loc.image_urls
  return loc.image_url ? [loc.image_url] : []
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function getRegion(loc: StreetliftingMyLocation): string {
  return Array.from(new Set([loc.province, loc.city, loc.county].filter(Boolean))).join(' · ') || loc.address || '未补充区域'
}

/** Drops a deleted point from the list and its totals; rank/score are refreshed by the next load. */
function withoutLocation(data: StreetliftingMyLocationsResult, id: string): StreetliftingMyLocationsResult {
  const removed = data.locations.find(loc => loc.id === id)
  if (!removed) return data
  return {
    locations: data.locations.filter(loc => loc.id !== id),
    summary: {
      ...data.summary,
      upload_count: Math.max(0, data.summary.upload_count - 1),
      image_count_total: Math.max(0, data.summary.image_count_total - getImages(removed).length),
      needs_update_count: Math.max(0, data.summary.needs_update_count - (removed.gaps.length ? 1 : 0)),
    },
  }
}

function openLocationsForm(query: string) {
  void Taro.navigateTo({ url: `/streetlifting/index/locations?${query}&from=mine` })
}

function SummaryCard({ summary }: { summary: StreetliftingMyLocationsResult['summary'] }) {
  return (
    <View className='mine-summary'>
      <View className='mine-summary__head'>
        <Text className='mine-summary__count'>{summary.upload_count}</Text>
        <Text className='mine-summary__unit'>个点位</Text>
      </View>
      <View className='mine-summary__stats'>
        <View className='mine-summary__stat'>
          <Text className='mine-summary__value'>{summary.rank ? `第 ${summary.rank} 名` : '—'}</Text>
          <Text className='mine-summary__label'>贡献排名</Text>
        </View>
        <View className='mine-summary__stat'>
          <Text className='mine-summary__value'>{summary.contribution_score ?? '—'}</Text>
          <Text className='mine-summary__label'>贡献分</Text>
        </View>
        <View className='mine-summary__stat'>
          <Text className='mine-summary__value'>{summary.image_count_total}</Text>
          <Text className='mine-summary__label'>照片</Text>
        </View>
      </View>
      {summary.needs_update_count > 0 && (
        <Text className='mine-summary__hint'>
          有 {summary.needs_update_count} 个点位待完善，补充照片、器材和定位后更容易被找到，也能提高贡献分。
        </Text>
      )}
    </View>
  )
}

function MyLocationCard({ loc, deleting, onDelete }: { loc: StreetliftingMyLocation; deleting: boolean; onDelete: (loc: StreetliftingMyLocation) => void }) {
  const images = getImages(loc)
  const hasPosition = isValidLocationCoordinates(loc.latitude, loc.longitude)

  const preview = () => {
    if (!images.length) {
      openLocationsForm(`edit=${encodeURIComponent(loc.id)}`)
      return
    }
    Taro.previewImage({ current: images[0], urls: images }).catch(() => {
      void Taro.showToast({ title: '图片暂时无法打开，请重试', icon: 'none' })
    })
  }

  const openMap = () => {
    if (!hasPosition) return
    const position = toWeChatCoordinates({ latitude: loc.latitude as number, longitude: loc.longitude as number, country: loc.country, coordinate_system: loc.coordinate_system })
    void Taro.navigateTo({ url: `/streetlifting/index/locations-map?latitude=${position.latitude}&longitude=${position.longitude}&name=${encodeURIComponent(loc.name)}&country=${encodeURIComponent(loc.country || '')}&id=${encodeURIComponent(loc.id)}` })
  }

  return (
    <View className='mine-card'>
      <View className='mine-card__body'>
        <View className='mine-card__thumb' onClick={preview}>
          {images.length ? (
            <Image className='mine-card__img' src={images[0]} mode='aspectFill' lazyLoad />
          ) : (
            <Text className='mine-card__noimg'>+ 照片</Text>
          )}
          {images.length > 1 && <Text className='mine-card__img-count'>{images.length}</Text>}
        </View>
        <View className='mine-card__main'>
          <Text className='mine-card__name' numberOfLines={1}>{loc.name}</Text>
          <Text className='mine-card__meta' numberOfLines={1}>{getRegion(loc)}</Text>
          <Text className='mine-card__meta'>上传于 {formatDate(loc.created_at)}</Text>
          <EquipmentTags location={loc} />
        </View>
      </View>
      {loc.gaps.length > 0 && (
        <View className='mine-card__gaps'>
          <Text className='mine-card__gaps-label'>待完善</Text>
          {loc.gaps.map(gap => <Text key={gap} className='mine-card__gap'>{LOCATION_GAP_LABELS[gap]}</Text>)}
        </View>
      )}
      <View className='mine-card__actions'>
        <View className='mine-card__delete' onClick={() => { if (!deleting) onDelete(loc) }}>
          <Text>{deleting ? '删除中…' : '删除'}</Text>
        </View>
        <View className={`mine-card__action${hasPosition ? '' : ' mine-card__action--disabled'}`} onClick={openMap}>
          <Text>{hasPosition ? '地图查看' : '暂无定位'}</Text>
        </View>
        <View className='mine-card__action mine-card__action--primary' onClick={() => openLocationsForm(`edit=${encodeURIComponent(loc.id)}`)}>
          <Text>{loc.gaps.length ? '去完善' : '编辑'}</Text>
        </View>
      </View>
    </View>
  )
}

export default function MyStreetliftingLocations() {
  const { effectiveTheme } = useTheme()
  const [data, setData] = useState<StreetliftingMyLocationsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  usePageEnterTrace()

  const load = async () => {
    if (!authService.isAuthenticated()) {
      setLoggedIn(false)
      setLoading(false)
      return
    }
    setLoggedIn(true)
    const cacheKey = `mine:${authService.getCurrentUser()?.id || ''}`
    const cached = readLocationCache<StreetliftingMyLocationsResult>(cacheKey)
    if (cached?.summary && Array.isArray(cached.locations)) setData(cached)
    setLoading(true)
    try {
      const result = await streetliftingIndexService.listMyLocations()
      writeLocationCache(cacheKey, result)
      setData(result)
    } catch (error) {
      Taro.showToast({ title: (error as Error)?.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const deleteLocation = async (loc: StreetliftingMyLocation) => {
    const answer = await Taro.showModal({
      title: '删除这个点位？',
      content: `「${loc.name}」会从单杠地图中移除，照片和信息无法恢复。只是信息有误的话，可以点「编辑」修改。`,
      confirmText: '删除',
      confirmColor: '#A33A2A',
      cancelText: '再想想'
    })
    if (!answer.confirm) return
    setDeletingId(loc.id)
    try {
      await streetliftingIndexService.deleteLocation(loc.id)
      const cacheKey = `mine:${authService.getCurrentUser()?.id || ''}`
      if (data) {
        const next = withoutLocation(data, loc.id)
        setData(next)
        writeLocationCache(cacheKey, next)
      }
      Taro.showToast({ title: '已删除', icon: 'success' })
      void load()
    } catch (error) {
      Taro.showToast({ title: (error as Error)?.message || '删除失败', icon: 'none' })
    } finally {
      setDeletingId(null)
    }
  }

  // Refresh on every show so edits made in the map form appear when returning.
  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load().then(() => Taro.stopPullDownRefresh()) })

  const visibleLocations = useMemo(
    () => (data?.locations || []).filter(loc => filter === 'all' || loc.gaps.length > 0),
    [data, filter]
  )

  const themeClass = `mine-page theme-${effectiveTheme}${effectiveTheme === 'dark' ? ' cl-theme-dark' : ''}`

  if (!loggedIn) {
    return (
      <View className={themeClass}>
        <View className='mine-empty'>
          <Text className='mine-empty__title'>登录后查看我的点位</Text>
          <Text className='mine-empty__desc'>你上传过的单杠会集中在这里，方便随时补充照片和器材。</Text>
          <View className='mine-primary-btn' onClick={() => Taro.navigateTo({ url: authService.buildLoginUrl(PAGE_ROUTE) })}>
            <Text>去登录</Text>
          </View>
        </View>
      </View>
    )
  }

  const total = data?.locations.length || 0
  const gapCount = data?.summary.needs_update_count || 0

  return (
    <View className={themeClass}>
      <View className='mine-scroll'>
        <View className='mine-content'>
          {data && <SummaryCard summary={data.summary} />}

          {total > 0 && (
            <View className='mine-tabs'>
              <View className={`mine-tab${filter === 'all' ? ' mine-tab--active' : ''}`} onClick={() => setFilter('all')}>
                <Text>全部 {total}</Text>
              </View>
              <View className={`mine-tab${filter === 'gaps' ? ' mine-tab--active' : ''}`} onClick={() => setFilter('gaps')}>
                <Text>待完善 {gapCount}</Text>
              </View>
            </View>
          )}

          {loading && !data ? (
            <View className='mine-empty'><Text className='mine-empty__desc'>加载中…</Text></View>
          ) : total === 0 ? (
            <View className='mine-empty'>
              <Text className='mine-empty__title'>还没有上传过单杠点位</Text>
              <Text className='mine-empty__desc'>把你常练的单杠分享出来，附近的人就能找到它。</Text>
            </View>
          ) : visibleLocations.length === 0 ? (
            <View className='mine-empty'>
              <Text className='mine-empty__title'>点位信息都很完整</Text>
              <Text className='mine-empty__desc'>感谢你的贡献！</Text>
            </View>
          ) : (
            visibleLocations.map(loc => <MyLocationCard key={loc.id} loc={loc} deleting={deletingId === loc.id} onDelete={(target) => { void deleteLocation(target) }} />)
          )}
        </View>
      </View>

      <View className='mine-bottom-bar'>
        <View className='mine-primary-btn' onClick={() => openLocationsForm('create=1')}>
          <Text>上传新点位</Text>
        </View>
      </View>
    </View>
  )
}
