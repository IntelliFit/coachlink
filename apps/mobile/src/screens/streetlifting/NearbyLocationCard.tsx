import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDistanceKm } from '@coachlink/core/src/locationMapBridge'
import { apiClient } from '../../api'
import { colors, radius, spacing } from '../../theme'
import { EquipmentTags } from './LocationEquipment'
import { getLocationImages, locationRegion, type NearbyLocation, type StreetliftingLocation } from './locationModel'

/** 「离你最近」的一张卡片。点位列表接口不带照片，这里单独取详情，失败可以重试，与小程序 NearbyLocationCard 一致。 */
export function NearbyLocationCard({ location, onOpenDetail, onOpenMap }: {
  location: NearbyLocation
  onOpenDetail: () => void
  onOpenMap: () => void
}) {
  const [details, setDetails] = useState<StreetliftingLocation | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    setLoadFailed(false)
    apiClient.request<{ location: StreetliftingLocation }>('/api/streetlifting-index/locations/get', { method: 'POST', body: { id: location.id }, timeoutMs: 12000 })
      .then((data) => { if (alive) setDetails(data.location) })
      .catch(() => { if (alive) setLoadFailed(true) })
    return () => {
      alive = false
    }
  }, [location.id, retry])

  const image = details ? getLocationImages(details)[0] : undefined
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`查看${location.name}，距离${formatDistanceKm(location.distanceKm)}`} onPress={onOpenDetail} style={styles.main}>
        <View style={styles.head}>
          <Text style={styles.name} numberOfLines={1}>{location.name}</Text>
          <Text style={styles.distance}>{formatDistanceKm(location.distanceKm)}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>{locationRegion(location)}</Text>
        <EquipmentTags location={location} />
        {image ? <Image source={{ uri: image }} style={styles.image} accessibilityIgnoresInvertColors /> : null}
        {!image && !details && !loadFailed ? <ActivityIndicator color={colors.brand} size="small" /> : null}
        {!image && details ? <Text style={styles.meta}>暂未上传现场照片</Text> : null}
      </Pressable>
      <View style={styles.actions}>
        {loadFailed ? (
          <Pressable accessibilityRole="button" accessibilityLabel="重新加载照片" onPress={() => setRetry((value) => value + 1)} style={styles.action}><Text style={styles.actionText}>照片加载失败，重试</Text></Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`在地图打开${location.name}`} onPress={onOpenMap} style={styles.action}><Text style={styles.actionText}>打开地图</Text></Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  main: { gap: spacing.xs, padding: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  name: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  distance: { color: colors.brand, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  image: { width: '100%', height: 140, borderRadius: radius.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
})
