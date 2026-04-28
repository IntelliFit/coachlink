import { studentService } from './studentService'

const DEFAULT_STUDENT_NEXT_URL = '/pages/index/index'
const DEFAULT_ONBOARDING_NEXT_URL = '/training/impromptu-training?from=onboarding'

const LEGACY_ROUTE_ALIASES: Record<string, string> = {
  '/index': '/pages/index/index'
}

const normalizeNextUrl = (value?: string | null, fallback = DEFAULT_STUDENT_NEXT_URL) => {
  if (!value || typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return fallback
  const aliased = LEGACY_ROUTE_ALIASES[trimmed] || trimmed
  if (aliased.startsWith('/auth/student-onboarding')) {
    return DEFAULT_ONBOARDING_NEXT_URL
  }
  return aliased
}

export const isCoreStudentProfileComplete = (profile: any) => {
  if (!profile || typeof profile !== 'object') return false

  const hasNickname = !!String(profile.nickname || '').trim()
  const hasGender = !!String(profile.gender || '').trim()
  const height = Number(profile.height || 0)
  const weight = Number(profile.weight || 0)
  const hasGoal = !!String(profile.fitness_goal || '').trim()
  const hasLevel = !!String(profile.fitness_level || '').trim()

  return hasNickname && hasGender && height > 0 && weight > 0 && hasGoal && hasLevel
}

export const requiresStudentOnboarding = (profile: any) => {
  if (!profile) return true
  if (profile.onboarding_completed !== true) return true
  return !isCoreStudentProfileComplete(profile)
}

export const buildStudentOnboardingUrl = (nextUrl = DEFAULT_ONBOARDING_NEXT_URL) => {
  const normalizedNext = normalizeNextUrl(nextUrl, DEFAULT_ONBOARDING_NEXT_URL)
  return `/auth/student-onboarding?next=${encodeURIComponent(normalizedNext)}`
}

const resolveDefaultUrlByRole = (loggedInUser: any) => {
  if (loggedInUser?.is_admin) return '/pages/index/index'
  if (loggedInUser?.is_coach && loggedInUser?.primary_role === 'coach') return '/coach/overview'
  return DEFAULT_STUDENT_NEXT_URL
}

class StudentOnboardingService {
  async resolvePostLoginUrl(options: { loggedInUser: any; fallbackUrl?: string | null }) {
    const { loggedInUser, fallbackUrl } = options
    const defaultUrl = resolveDefaultUrlByRole(loggedInUser)
    const nextUrl = normalizeNextUrl(fallbackUrl, defaultUrl)

    if (!loggedInUser?.id) return nextUrl
    if (loggedInUser?.is_admin) return nextUrl
    if (loggedInUser?.is_coach && loggedInUser?.primary_role === 'coach') return nextUrl

    try {
      const profileRes = await studentService.getStudentProfile(loggedInUser.id)
      if (requiresStudentOnboarding(profileRes?.profile ?? null)) {
        return buildStudentOnboardingUrl(nextUrl)
      }
    } catch (error) {
      console.error('[studentOnboardingService] resolvePostLoginUrl failed:', error)
    }

    return nextUrl
  }
}

export const studentOnboardingService = new StudentOnboardingService()
