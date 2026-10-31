import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { WebView } from 'react-native-webview'
import { isMapPageUrl, mapBridgeScript, parseMapBridgeEvent, type MapBridgeCommand, type MapBridgeEvent } from '@coachlink/core/src/locationMapBridge'
import { API_BASE_URL } from '../../config'
import { withTimeout } from '../../withTimeout'
import { colors, radius, spacing } from '../../theme'

const READY_TIMEOUT_MS = 20_000
const PAGE_LOCATE_TIMEOUT_MS = 12_000
const POSITION_UNAVAILABLE = '暂时拿不到你的位置，可以搜索城市、公园或地址。'

export type LocationMapHandle = {
  send: (command: MapBridgeCommand) => void
  /** 让网页走系统定位取位置，见 userLocation.ts 的 locateWithMapFallback。 */
  locate: () => Promise<{ latitude: number; longitude: number }>
}

type Props = {
  mode: 'browse' | 'pick'
  onEvent?: (event: MapBridgeEvent) => void
  /** 地图打不开时通知页面，浏览页可以退回列表。 */
  onFailed?: (message: string) => void
  style?: StyleProp<ViewStyle>
}

/** 单杠地图：WebView 打开网页 /embed/locations-map。原因和协议见 packages/core/src/locationMapBridge.ts。 */
export const LocationMapView = forwardRef<LocationMapHandle, Props>(function LocationMapView({ mode, onEvent, onFailed, style }, ref) {
  const webRef = useRef<WebView>(null)
  const readyRef = useRef(false)
  const queueRef = useRef<MapBridgeCommand[]>([])
  // 地图进程被系统杀掉后重开，点位要重新发一次
  const lastPinsRef = useRef<MapBridgeCommand | null>(null)
  const pendingLocateRef = useRef<{ resolve: (position: { latitude: number; longitude: number }) => void; reject: (error: Error) => void } | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState('')
  const [attempt, setAttempt] = useState(0)

  const fail = useCallback((message: string) => {
    if (readyRef.current) return
    setFailed(message)
    onFailed?.(message)
  }, [onFailed])

  useEffect(() => {
    if (ready || failed) return undefined
    const timer = setTimeout(() => fail('地图加载超时，请检查网络后重试'), READY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [attempt, fail, failed, ready])

  const send = useCallback((command: MapBridgeCommand) => {
    if (command.type === 'setPins') lastPinsRef.current = command
    if (readyRef.current) webRef.current?.injectJavaScript(mapBridgeScript(command))
    else queueRef.current = [...queueRef.current, command]
  }, [])

  useImperativeHandle(ref, () => ({
    send,
    locate() {
      return withTimeout(new Promise((resolve, reject) => {
        pendingLocateRef.current = { resolve, reject }
        send({ type: 'locate' })
      }), PAGE_LOCATE_TIMEOUT_MS, POSITION_UNAVAILABLE)
    },
  }), [send])

  const restart = () => {
    readyRef.current = false
    setReady(false)
    setAttempt((value) => value + 1)
    if (lastPinsRef.current && !queueRef.current.includes(lastPinsRef.current)) queueRef.current = [lastPinsRef.current, ...queueRef.current]
  }

  const retry = () => {
    setFailed('')
    restart()
  }

  return (
    <View style={[styles.wrap, style]}>
      {failed ? null : (
        <WebView
          key={attempt}
          ref={webRef}
          source={{ uri: `${API_BASE_URL.replace(/\/+$/, '')}/embed/locations-map?mode=${mode}` }}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(request) => isMapPageUrl(request.url, API_BASE_URL)}
          onMessage={(event) => {
            const message = parseMapBridgeEvent(event.nativeEvent.data)
            if (!message) return
            if (message.type === 'ready') {
              readyRef.current = true
              setReady(true)
              queueRef.current.forEach((command) => webRef.current?.injectJavaScript(mapBridgeScript(command)))
              queueRef.current = []
            } else if (message.type === 'failed') {
              fail(message.message)
            } else if (message.type === 'located') {
              pendingLocateRef.current?.resolve({ latitude: message.latitude, longitude: message.longitude })
              pendingLocateRef.current = null
            } else if (message.type === 'locateFailed') {
              pendingLocateRef.current?.reject(new Error(POSITION_UNAVAILABLE))
              pendingLocateRef.current = null
            }
            onEvent?.(message)
          }}
          onError={() => fail('地图加载失败，请检查网络后重试')}
          onHttpError={() => fail('地图暂时打不开，请稍后重试')}
          onRenderProcessGone={restart}
          onContentProcessDidTerminate={restart}
          geolocationEnabled={Platform.OS === 'android'}
          setBuiltInZoomControls={false}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          style={styles.web}
        />
      )}
      {!ready && !failed ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.overlayText}>正在加载地图</Text>
        </View>
      ) : null}
      {failed ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>{failed}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="重新加载地图" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>重新加载</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  web: { flex: 1, backgroundColor: 'transparent' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md, backgroundColor: colors.surfaceMuted },
  overlayText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  retryText: { color: colors.brand, fontSize: 14, fontWeight: '700' },
})
