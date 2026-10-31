import { useCallback, useMemo, useState } from 'react'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LOCATION_GAP_LABELS } from '@coachlink/core'
import { apiClient } from '../../api'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import type { RootStackParamList } from '../../navigation/types'
import { EmptyState, LoadingState, ScreenShell, SolidButton, errorMessage } from '../me/MeShared'
import { EquipmentTags } from './LocationEquipment'
import { StreetliftingLocationFormModal } from './StreetliftingLocationFormModal'
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import { openSystemMap } from './StreetliftingExtraScreens'
import {
  getLocationImages,
  locationRegion,
  withoutLocation,
  type MyLocationsResult,
  type StreetliftingLocation,
  type StreetliftingMyLocation,
  markLocationsChanged,
} from './locationModel'

type Props = NativeStackScreenProps<RootStackParamList, 'StreetliftingMyLocations'>
type Filter = 'all' | 'gaps'

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return toBeijingDateKey(date).replace(/-/g, '.')
}

/** 我的点位：上传过的单杠、贡献排名和每个点位还缺什么。对应小程序 streetlifting/index/my-locations。 */
export function StreetliftingMyLocationsScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth()
  const [data, setData] = useState<MyLocationsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [editing, setEditing] = useState<StreetliftingLocation | null>(null)
  const [preview, setPreview] = useState<{ urls: string[]; initial: string } | null>(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setData(await apiClient.request<MyLocationsResult>('/api/streetlifting-index/locations/mine', { method: 'POST', body: {}, timeoutMs: 15000 }))
    } catch (loadError) {
      setError(errorMessage(loadError, '获取我的点位失败'))
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const visible = useMemo(() => (data?.locations || []).filter((location) => filter === 'all' || location.gaps.length > 0), [data, filter])

  function openForm(location: StreetliftingLocation | null) {
    setEditing(location)
    setFormVisible(true)
  }

  function confirmDelete(location: StreetliftingMyLocation) {
    Alert.alert('删除这个点位？', `「${location.name}」会从单杠地图中移除，照片和信息无法恢复。只是信息有误的话，可以点「编辑」修改。`, [
      { text: '再想想', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(location.id)
          try {
            await apiClient.request('/api/streetlifting-index/locations/delete', { method: 'POST', body: { id: location.id }, timeoutMs: 12000 })
            markLocationsChanged()
            setData((current) => (current ? withoutLocation(current, location.id) : current))
            void load()
          } catch (deleteError) {
            Alert.alert('删除失败', errorMessage(deleteError))
          } finally {
            setDeletingId(null)
          }
        },
      },
    ])
  }

  if (!isAuthenticated) {
    return (
      <ScreenShell title="我的点位" onBack={() => navigation.goBack()}>
        <EmptyState title="登录后查看我的点位" desc="你上传过的单杠会集中在这里，方便随时补充照片和器材。" icon="icon-location" />
        <SolidButton label="去登录" onPress={() => navigation.navigate('Login')} />
      </ScreenShell>
    )
  }

  const total = data?.locations.length || 0
  const summary = data?.summary

  return (
    <ScreenShell title="我的点位" subtitle="上传过的单杠和还可以补充的信息" onBack={() => navigation.goBack()}>
      {summary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryCount}>{summary.upload_count}<Text style={styles.summaryUnit}> 个点位</Text></Text>
          <View style={styles.summaryStats}>
            <Stat label="贡献排名" value={summary.rank ? `第 ${summary.rank} 名` : '—'} />
            <Stat label="贡献分" value={String(summary.contribution_score ?? '—')} />
            <Stat label="照片" value={String(summary.image_count_total)} />
          </View>
          {summary.needs_update_count > 0 ? <Text style={styles.hint}>有 {summary.needs_update_count} 个点位待完善，补充照片、器材和定位后更容易被找到，也能提高贡献分。</Text> : null}
        </View>
      ) : null}

      {total > 0 ? (
        <View style={styles.tabs}>
          {([['all', `全部 ${total}`], ['gaps', `待完善 ${summary?.needs_update_count || 0}`]] as const).map(([key, label]) => (
            <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[styles.tab, filter === key && styles.tabActive]}>
              <Text style={[styles.tabText, filter === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {loading && !data ? <LoadingState title="加载中" /> : null}
      {!loading && error && !data ? <EmptyState title="加载失败" desc={error} /> : null}
      {!loading && !error && data && total === 0 ? <EmptyState title="还没有上传过单杠点位" desc="把你常练的单杠分享出来，附近的人就能找到它。" icon="icon-location" /> : null}
      {data && total > 0 && visible.length === 0 ? <EmptyState title="点位信息都很完整" desc="感谢你的贡献！" icon="icon-location" /> : null}

      {visible.map((location) => {
        const images = getLocationImages(location)
        const hasPosition = location.latitude != null && location.longitude != null
        const deleting = deletingId === location.id
        return (
          <View key={location.id} style={styles.card}>
            <View style={styles.cardBody}>
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel={images.length ? `查看${location.name}的照片` : `为${location.name}添加照片`}
                onPress={() => (images.length ? setPreview({ urls: images, initial: images[0] }) : openForm(location))}
                style={styles.thumb}
              >
                {images.length ? <Image source={{ uri: images[0] }} style={styles.thumbImage} accessibilityIgnoresInvertColors /> : <Text style={styles.noImage}>+ 照片</Text>}
                {images.length > 1 ? <Text style={styles.imageCount}>{images.length}</Text> : null}
              </Pressable>
              <View style={styles.cardMain}>
                <Text style={styles.name} numberOfLines={1}>{location.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{locationRegion(location)}</Text>
                <Text style={styles.meta}>上传于 {formatDate(location.created_at)}</Text>
                <EquipmentTags location={location} />
              </View>
            </View>
            {location.gaps.length > 0 ? (
              <View style={styles.gaps}>
                <Text style={styles.gapsLabel}>待完善</Text>
                {location.gaps.map((gap) => <Text key={gap} style={styles.gap}>{LOCATION_GAP_LABELS[gap]}</Text>)}
              </View>
            ) : null}
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`删除${location.name}`} accessibilityState={{ disabled: deleting, busy: deleting }} disabled={deleting} onPress={() => confirmDelete(location)} style={styles.action}>
                <Text style={styles.deleteText}>{deleting ? '删除中…' : '删除'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={hasPosition ? `在地图查看${location.name}` : '暂无定位'} accessibilityState={{ disabled: !hasPosition }} disabled={!hasPosition} onPress={() => hasPosition && void openSystemMap({ ...location, latitude: location.latitude as number, longitude: location.longitude as number })} style={styles.action}>
                <Text style={[styles.actionText, !hasPosition && styles.actionDisabled]}>{hasPosition ? '地图查看' : '暂无定位'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={location.gaps.length ? `完善${location.name}` : `编辑${location.name}`} onPress={() => openForm(location)} style={[styles.action, styles.actionPrimary]}>
                <Text style={styles.actionPrimaryText}>{location.gaps.length ? '去完善' : '编辑'}</Text>
              </Pressable>
            </View>
          </View>
        )
      })}

      <SolidButton label="上传新点位" onPress={() => openForm(null)} />

      <StreetliftingLocationFormModal
        visible={formVisible}
        editing={editing}
        onClose={() => setFormVisible(false)}
        onSaved={() => {
          setFormVisible(false)
          void load()
        }}
      />
      <ImagePreviewModal urls={preview?.urls || []} initialUrl={preview?.initial || null} onClose={() => setPreview(null)} />
    </ScreenShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  summaryCount: { color: colors.text, fontSize: 28, fontWeight: '700' },
  summaryUnit: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  summaryStats: { flexDirection: 'row', gap: spacing.xs },
  stat: { flex: 1, gap: 2 },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  card: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardBody: { flexDirection: 'row', gap: spacing.sm },
  thumb: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  thumbImage: { width: 80, height: 80 },
  noImage: { color: colors.textTertiary, fontSize: 12 },
  imageCount: { position: 'absolute', right: 4, bottom: 4, overflow: 'hidden', paddingHorizontal: 6, borderRadius: radius.pill, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.6)', fontSize: 11 },
  cardMain: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textTertiary, fontSize: 12 },
  gaps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  gapsLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  gap: { overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, color: colors.warning, backgroundColor: colors.surfaceMuted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  action: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actionDisabled: { color: colors.textMuted },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  actionPrimary: { backgroundColor: colors.brand },
  actionPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
})
