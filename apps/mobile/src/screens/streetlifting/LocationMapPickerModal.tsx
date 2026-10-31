import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { toTianDiTuCoordinates, type LocationSearchResult, type LocationSelection } from '@coachlink/core'
import { MIN_PICK_ZOOM, type MapBridgeEvent } from '@coachlink/core/src/locationMapBridge'
import { apiClient } from '../../api'
import { colors, radius, spacing } from '../../theme'
import { LocationMapView, type LocationMapHandle } from './LocationMapView'
import { explainLocationError, locateWithMapFallback } from './userLocation'

const PICK_ZOOM = 15

type Initial = { latitude: number; longitude: number; coordinate_system?: LocationSelection['coordinate_system'] | null; country?: string | null } | null

/** 地图选点，对应小程序 locations-map?mode=pick：定位或搜索到附近，点地图标记单杠的实际位置。 */
export function LocationMapPickerModal({ visible, initial, onClose, onConfirm }: {
  visible: boolean
  initial: Initial
  onClose: () => void
  onConfirm: (selection: LocationSelection) => void
}) {
  const mapRef = useRef<LocationMapHandle>(null)
  const [picked, setPicked] = useState<LocationSelection | null>(null)
  const [resolving, setResolving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [message, setMessage] = useState('')
  // 定位最多要等十几秒，这期间用户搜索或选了点，就不再把地图拉回去
  const locateVersionRef = useRef(0)

  async function locate(explain: boolean) {
    if (locating) return
    const version = ++locateVersionRef.current
    setLocating(true)
    try {
      const position = await locateWithMapFallback(mapRef.current)
      if (version !== locateVersionRef.current) return
      mapRef.current?.send({ type: 'moveTo', ...position, zoom: PICK_ZOOM })
      mapRef.current?.send({ type: 'showUser', ...position })
      setMessage('已到你附近。拖动地图找到单杠，点到具体位置再确认。')
    } catch (error) {
      if (version !== locateVersionRef.current) return
      if (explain) explainLocationError(error, '需要允许定位才能到你附近。也可以直接搜索城市、公园或地址。')
      else setMessage('未能定位到你附近。可以点「定位我附近」重试，或搜索城市、公园和地址。')
    } finally {
      setLocating(false)
    }
  }

  useEffect(() => {
    if (!visible) return
    setPicked(null)
    setResolving(false)
    setQuery('')
    setResults([])
    setMessage('')
    if (initial) {
      const position = toTianDiTuCoordinates(initial)
      mapRef.current?.send({ type: 'moveTo', latitude: position.latitude, longitude: position.longitude, zoom: PICK_ZOOM })
      mapRef.current?.send({ type: 'setPicked', latitude: position.latitude, longitude: position.longitude })
      setMessage('这是当前保存的位置，点地图可以改到新的位置。')
    } else {
      void locate(false)
    }
  }, [visible])

  function handleEvent(event: MapBridgeEvent) {
    if (event.type === 'pickTooFar') {
      setMessage('地图还太远，请放大后再点具体位置。')
      return
    }
    if (event.type !== 'picked') return
    locateVersionRef.current += 1
    setMessage('')
    setResults([])
    setResolving(event.resolving)
    setPicked({
      name: event.name,
      address: event.address,
      country: event.country,
      province: event.province,
      city: event.city,
      county: event.county,
      latitude: event.latitude,
      longitude: event.longitude,
      coordinate_system: 'wgs84',
    })
  }

  async function search() {
    const text = query.trim()
    if (!text || searching) return
    locateVersionRef.current += 1
    setSearching(true)
    setMessage('')
    try {
      const rows = await apiClient.request<LocationSearchResult[]>('/api/streetlifting-index/locations/search-places', { method: 'POST', body: { query: text }, timeoutMs: 12000 })
      setResults(Array.isArray(rows) ? rows : [])
      if (!Array.isArray(rows) || rows.length === 0) setMessage('没有找到这个地点，可以换个关键词。')
    } catch (error) {
      setResults([])
      setMessage(error instanceof Error ? error.message : '地点搜索失败，可以直接在地图上选。')
    } finally {
      setSearching(false)
    }
  }

  function selectResult(result: LocationSearchResult) {
    const position = toTianDiTuCoordinates(result)
    const zoom = result.zoom || PICK_ZOOM
    mapRef.current?.send({ type: 'moveTo', latitude: position.latitude, longitude: position.longitude, zoom })
    // 搜到的是城市这种大范围时，不能把中心点当成单杠位置
    if (zoom >= MIN_PICK_ZOOM) {
      mapRef.current?.send({ type: 'setPicked', latitude: position.latitude, longitude: position.longitude })
      setPicked(result)
      setMessage('已到达所选地点。可以点单杠的具体位置，或确认当前标记。')
    } else {
      setPicked(null)
      setMessage('已到达目标区域。请放大地图，点单杠的具体位置。')
    }
    setResolving(false)
    setResults([])
    setQuery('')
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消选点" onPress={onClose} style={styles.toolButton}><Text style={styles.toolText}>取消</Text></Pressable>
          <Text style={styles.title}>标记单杠的实际位置</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="定位我附近" accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={() => void locate(true)} style={styles.toolButton}><Text style={styles.toolText}>{locating ? '定位中…' : '定位我附近'}</Text></Pressable>
        </View>
        <View style={styles.searchRow}>
          <TextInput accessibilityLabel="搜索地点" value={query} maxLength={160} onChangeText={setQuery} onSubmitEditing={() => void search()} returnKeyType="search" placeholder="城市、公园或地址，例如 Tokyo" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel="搜索地点" accessibilityState={{ disabled: !query.trim() || searching, busy: searching }} disabled={!query.trim() || searching} onPress={() => void search()} style={[styles.searchButton, (!query.trim() || searching) && styles.disabled]}>
            {searching ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.searchButtonText}>搜索</Text>}
          </Pressable>
        </View>
        {results.length ? (
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.map((result) => (
              <Pressable key={result.id} accessibilityRole="button" accessibilityLabel={`选择${result.name}`} onPress={() => selectResult(result)} style={styles.result}>
                <Text style={styles.pickedTitle} numberOfLines={1}>{result.name}</Text>
                <Text style={styles.help} numberOfLines={2}>{result.address}</Text>
              </Pressable>
            ))}
            <Text style={styles.help}>地点数据 © OpenStreetMap contributors · 搜索由 Photon 提供</Text>
          </ScrollView>
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {visible ? <LocationMapView ref={mapRef} mode="pick" onEvent={handleEvent} style={styles.map} /> : null}
        <View style={styles.footer}>
          <Text style={styles.pickedTitle} numberOfLines={1}>{picked ? picked.name || '已选地图位置' : '点地图选择单杠位置'}</Text>
          {picked ? <Text style={styles.help} numberOfLines={2}>{resolving ? '正在查询地址…' : picked.address || '位置已记录，未返回详细地址，确认后请补充。'}</Text> : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="选取地图中心" onPress={() => mapRef.current?.send({ type: 'pickCenter' })} style={styles.secondaryButton}><Text style={styles.secondaryText}>选取地图中心</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="确认地图标记" accessibilityState={{ disabled: !picked || resolving }} disabled={!picked || resolving} onPress={() => picked && onConfirm(picked)} style={[styles.primaryButton, (!picked || resolving) && styles.disabled]}><Text style={styles.primaryText}>确认地图标记</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, paddingHorizontal: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  toolButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  toolText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.xs },
  input: { flex: 1, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 14 },
  searchButton: { minWidth: 64, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.brand },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  results: { maxHeight: 220, paddingHorizontal: spacing.sm },
  result: { minHeight: 48, justifyContent: 'center', gap: 2, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  message: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xs, color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  map: { flex: 1 },
  footer: { gap: 4, padding: spacing.sm, backgroundColor: colors.surface },
  pickedTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  help: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  secondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  primaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.brand },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
})
