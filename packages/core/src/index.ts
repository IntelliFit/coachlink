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

export type AuthSession = {
  user: CoachLinkUser
  token: string
}

export type MainTabKey = 'training' | 'coaches' | 'knowledge' | 'toolbox' | 'profile'
