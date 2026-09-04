import Constants from 'expo-constants'
import { Platform } from 'react-native'
import rootPackage from '../../../package.json'

const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined

function configuredApiBaseUrl(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  return normalized || null
}

function defaultApiBaseUrl(): string {
  // Android 模拟器中的 127.0.0.1 指向模拟器自身；10.0.2.2 才是开发机。
  if (__DEV__ && Platform.OS === 'android') return 'http://10.0.2.2:3000'
  if (__DEV__) return 'http://127.0.0.1:3000'
  return 'https://coachlink.fit'
}

export const API_BASE_URL =
  configuredApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ||
  configuredApiBaseUrl(extra?.apiBaseUrl) ||
  defaultApiBaseUrl()

export const SHOW_DEBUG_LOGIN =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGIN === 'true'

export const APP_VERSION = Constants.expoConfig?.version || rootPackage.version || '0.0.0'
