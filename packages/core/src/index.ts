export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  message?: string
}

export type CoachLinkUser = {
  id: string
  phone?: string | null
  email?: string | null
  nickname?: string | null
  name?: string | null
  avatar_url?: string | null
  avatar?: string | null
  primary_role?: 'student' | 'coach' | 'admin' | string | null
  is_coach?: boolean | null
  is_admin?: boolean | null
}

export type CoachLinkAppRole = 'student' | 'coach'

/**
 * The selected product surface is driven by primary_role. Coach eligibility
 * alone must never force a user out of the student experience.
 */
export function resolveCoachLinkAppRole(user?: CoachLinkUser | null): CoachLinkAppRole {
  return user?.primary_role === 'coach' && user?.is_coach === true ? 'coach' : 'student'
}

export function canSwitchCoachLinkAppRole(user: CoachLinkUser | null | undefined, role: CoachLinkAppRole) {
  if (!user?.id) return false
  if (role === 'student') return true
  return user.is_coach === true
}

export type AuthSession = {
  user: CoachLinkUser
  token: string
}

export type MainTabKey = 'training' | 'coaches' | 'knowledge' | 'toolbox' | 'profile'

export * from './aiNavigator'
export * from './wechatReleasePolicy'
export * from './locationCoordinates'
export * from './locationSearch'
export * from './locationCountry'
export * from './locationMapView'
export * from './locationEquipment'
