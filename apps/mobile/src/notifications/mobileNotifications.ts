import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { apiClient } from '../api'
import { APP_VERSION } from '../config'
import { rootNavigationRef } from '../navigation/navigationRef'

const INSTALLATION_ID_KEY = 'coachlink_mobile_push_installation_id_v1'
// This is only a registration marker. Expo tokens are credentials-like values
// and do not need to be persisted in plaintext AsyncStorage.
const PUSH_TOKEN_KEY = 'coachlink_mobile_expo_push_token_v1'
const PUSH_USER_KEY = 'coachlink_mobile_push_user_v1'
export const MESSAGE_NOTIFICATION_CHANNEL_ID = 'messages'

export type MobilePushState = {
  permission: string
  registration: 'registered' | 'disabled' | 'missing-project-id' | 'unavailable' | 'error'
  message: string
}

/** 正在看的会话又来新消息时，聊天页自己会轮询刷新，不再弹横幅打断。 */
function isViewingChatRoom(data: Record<string, unknown> | undefined) {
  if (!data || data.kind !== 'chat_message' || typeof data.roomId !== 'string') return false
  if (!rootNavigationRef.isReady()) return false
  const route = rootNavigationRef.getCurrentRoute()
  return route?.name === 'Chat' && (route.params as { roomId?: string } | undefined)?.roomId === data.roomId
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const quiet = isViewingChatRoom(notification.request.content.data)
    return {
      shouldPlaySound: !quiet,
      shouldSetBadge: true,
      shouldShowBanner: !quiet,
      shouldShowList: !quiet,
    }
  },
})

function makeInstallationId() {
  return `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`
}

async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY)
  if (existing) return existing
  const created = makeInstallationId()
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created)
  return created
}

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId
    || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    || ''
  )
}

function supportsNativePush() {
  return Platform.OS === 'android' || Platform.OS === 'ios'
}

function deviceMetadata() {
  try {
    const options = Intl.DateTimeFormat().resolvedOptions()
    return { locale: options.locale, timezone: options.timeZone }
  } catch {
    return { locale: undefined, timezone: undefined }
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(MESSAGE_NOTIFICATION_CHANNEL_ID, {
    name: '消息通知',
    description: '教练、学员和系统消息提醒',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#CF6D4E',
  })
}

async function registerGrantedDevice(userId: string, permission: string): Promise<MobilePushState> {
  if (!Device.isDevice) {
    return {
      permission,
      registration: 'unavailable',
      message: '远程推送需要在 Android 或 iPhone 真机上测试。',
    }
  }
  const projectId = getProjectId()
  if (!projectId) {
    return {
      permission,
      registration: 'missing-project-id',
      message: '通知权限已开启；配置 EAS Project ID 后可注册远程推送。',
    }
  }

  try {
    await ensureAndroidChannel()
    const installationId = await getInstallationId()
    const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    if (!/^(?:ExpoPushToken|ExponentPushToken)\[[^\]]{8,512}\]$/.test(pushToken)) {
      throw new Error('Expo returned an invalid push token')
    }
    const previousUserId = await AsyncStorage.getItem(PUSH_USER_KEY)
    if (previousUserId && previousUserId !== userId) {
      await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_USER_KEY])
    }
    const metadata = deviceMetadata()
    await apiClient.request('/api/mobile/push/register', {
      method: 'POST',
      body: {
        installationId,
        pushToken,
        platform: Platform.OS,
        permissionStatus: permission,
        appVersion: APP_VERSION,
        locale: metadata.locale,
        timezone: metadata.timezone,
        deviceModel: Device.modelName,
      },
      timeoutMs: 12_000,
    })
    await AsyncStorage.multiSet([[PUSH_TOKEN_KEY, 'registered'], [PUSH_USER_KEY, userId]])
    return { permission, registration: 'registered', message: '远程消息提醒已开启。' }
  } catch {
    return {
      permission,
      registration: 'error',
      message: '推送设备注册失败，请检查网络后重试。',
    }
  }
}

export async function readMobilePushState(userId?: string): Promise<MobilePushState> {
  if (!supportsNativePush()) {
    return { permission: 'unavailable', registration: 'unavailable', message: '当前平台不支持原生消息通知。' }
  }
  if (!Device.isDevice) {
    return { permission: 'unavailable', registration: 'unavailable', message: '远程推送需要在 Android 或 iPhone 真机上测试。' }
  }
  try {
    await ensureAndroidChannel()
    const permissions = await Notifications.getPermissionsAsync()
    if (permissions.status !== 'granted') {
      return { permission: permissions.status, registration: 'disabled', message: '消息通知尚未开启。' }
    }
    const [[, marker], [, registeredUserId]] = await AsyncStorage.multiGet([PUSH_TOKEN_KEY, PUSH_USER_KEY])
    if (!getProjectId()) {
      return { permission: permissions.status, registration: 'missing-project-id', message: '通知权限已开启；远程推送尚未完成项目配置。' }
    }
    if (userId && registeredUserId !== userId) {
      return { permission: permissions.status, registration: 'error', message: '当前账号的设备推送尚未完成注册。' }
    }
    return marker
      ? { permission: permissions.status, registration: 'registered', message: '远程消息提醒已开启。' }
      : { permission: permissions.status, registration: 'error', message: '通知权限已开启，设备尚未完成注册。' }
  } catch {
    return { permission: 'unknown', registration: 'error', message: '暂时无法读取系统通知状态。' }
  }
}

export async function enableMobilePush(userId: string): Promise<MobilePushState> {
  if (!supportsNativePush()) {
    return { permission: 'unavailable', registration: 'unavailable', message: '当前平台不支持原生消息通知。' }
  }
  if (!Device.isDevice) {
    return { permission: 'unavailable', registration: 'unavailable', message: '远程推送需要在 Android 或 iPhone 真机上测试。' }
  }
  await ensureAndroidChannel()
  let permissions = await Notifications.getPermissionsAsync()
  if (permissions.status !== 'granted') permissions = await Notifications.requestPermissionsAsync()
  if (permissions.status !== 'granted') {
    return { permission: permissions.status, registration: 'disabled', message: '未获得系统通知权限，可在系统设置中重新开启。' }
  }
  return registerGrantedDevice(userId, permissions.status)
}

export async function syncExistingMobilePush(userId: string): Promise<MobilePushState> {
  const state = await readMobilePushState(userId)
  if (state.permission !== 'granted') {
    const registeredUserId = await AsyncStorage.getItem(PUSH_USER_KEY)
    if (state.registration === 'disabled' && registeredUserId === userId) {
      await unregisterMobilePush()
    }
    return state
  }
  return registerGrantedDevice(userId, state.permission)
}

export async function unregisterMobilePush(): Promise<void> {
  const installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY)
  if (installationId) {
    await apiClient.request('/api/mobile/push/register', {
      method: 'DELETE',
      body: { installationId },
      timeoutMs: 8_000,
    }).catch(() => undefined)
  }
  await AsyncStorage.multiRemove([PUSH_TOKEN_KEY, PUSH_USER_KEY])
  await Notifications.setBadgeCountAsync(0).catch(() => false)
}

export async function setApplicationBadge(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(Number(count) || 0))).catch(() => false)
}

export { Notifications }
