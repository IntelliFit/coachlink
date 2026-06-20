import Constants from 'expo-constants'
import rootPackage from '../../../package.json'

const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  extra?.apiBaseUrl ||
  'http://127.0.0.1:3000'

export const SHOW_DEBUG_LOGIN =
  __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEBUG_LOGIN === 'true'

export const APP_VERSION = Constants.expoConfig?.version || rootPackage.version || '0.0.0'
