import { Alert, Linking, Platform } from 'react-native'
import * as Location from 'expo-location'
import { withTimeout } from '../../withTimeout'

const BALANCED_TIMEOUT_MS = 5_000
const HIGH_ACCURACY_TIMEOUT_MS = 6_000
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000

export class LocationPermissionError extends Error {}
export class LocationServicesOffError extends Error {}

const POSITION_UNAVAILABLE = '暂时拿不到你的位置，可以搜索城市、公园或地址。'

/** 只在定位相关的功能里取一次当前位置，只用来移动地图和算距离，不保存到服务器。返回 WGS84。 */
export async function getCurrentPosition() {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (!permission.granted) throw new LocationPermissionError('定位权限未开启')
  if (!(await Location.hasServicesEnabledAsync())) throw new LocationServicesOffError('手机的定位服务没有打开')
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(() => null)
  // 省电模式在国内经常等不到结果，失败后再要一次高精度
  const attempts = [
    { accuracy: Location.Accuracy.Balanced, timeoutMs: BALANCED_TIMEOUT_MS },
    { accuracy: Location.Accuracy.High, timeoutMs: HIGH_ACCURACY_TIMEOUT_MS },
  ]
  for (const attempt of attempts) {
    try {
      const position = await withTimeout(Location.getCurrentPositionAsync({ accuracy: attempt.accuracy }), attempt.timeoutMs, POSITION_UNAVAILABLE)
      return { latitude: position.coords.latitude, longitude: position.coords.longitude }
    } catch {
      // 再试下一种
    }
  }
  if (lastKnown) return { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude }
  throw new Error(POSITION_UNAVAILABLE)
}

/**
 * expo-location 在安卓上只走谷歌服务，国内很多手机没有，这时改由地图页的 WebView 走系统定位。
 * 地图页之外没有这条路，列表的「附近」失败时引导用户去地图页。
 */
export async function locateWithMapFallback(map: { locate: () => Promise<{ latitude: number; longitude: number }> } | null) {
  try {
    return await getCurrentPosition()
  } catch (error) {
    if (Platform.OS !== 'android' || !map || error instanceof LocationPermissionError || error instanceof LocationServicesOffError) throw error
    return map.locate()
  }
}

export function explainLocationError(error: unknown, permissionMessage: string) {
  if (error instanceof LocationPermissionError) {
    Alert.alert('定位权限未开启', permissionMessage, [
      { text: '先不用', style: 'cancel' },
      { text: '去设置', onPress: () => void Linking.openSettings().catch(() => undefined) },
    ])
    return
  }
  Alert.alert('定位失败', error instanceof Error && error.message ? error.message : '定位暂不可用，请稍后再试。')
}
