import { useCallback, useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import {
  MY_BODY_METRICS_STORAGE_KEY,
  applyProfileBodyMetricsPatch,
  parseRememberedBodyMetrics,
  readProfileBodyMetrics,
  resolveBodyMetricsDefaults,
  toRememberedBodyMetrics,
  type BodyMetrics,
  type ProfileBodyMetricsPatch
} from '@coachlink/core/src/bodyMetrics'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'

interface MyBodyMetricsState {
  /** True once the profile request settled (signed out or failed also counts). */
  loaded: boolean
  signedIn: boolean
  profile: BodyMetrics
  remembered: BodyMetrics | null
}

const EMPTY: BodyMetrics = { heightCm: null, weightKg: null }

function readRemembered(): BodyMetrics | null {
  try {
    return parseRememberedBodyMetrics(Taro.getStorageSync(MY_BODY_METRICS_STORAGE_KEY))
  } catch {
    return null
  }
}

/**
 * The signed-in user's own height/weight for tools that "measure yourself by default".
 * Mirrors the Web hook (src/hooks/useMyBodyMetrics.ts); signed-out users get empty defaults.
 */
export function useMyBodyMetrics() {
  const [state, setState] = useState<MyBodyMetricsState>({
    loaded: false,
    signedIn: false,
    profile: EMPTY,
    remembered: null
  })

  useEffect(() => {
    let cancelled = false
    const remembered = readRemembered()
    const load = async () => {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated || !session.user?.id) {
        setState({ loaded: true, signedIn: false, profile: EMPTY, remembered })
        return
      }
      try {
        const res = await studentService.getStudentProfile(session.user.id)
        if (cancelled) return
        setState({ loaded: true, signedIn: true, profile: readProfileBodyMetrics(res?.profile), remembered })
      } catch (error) {
        console.warn('[body-metrics] load profile failed:', error)
        if (!cancelled) setState({ loaded: true, signedIn: true, profile: EMPTY, remembered })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const defaults = useMemo(
    () => resolveBodyMetricsDefaults(state.profile, state.remembered),
    [state.profile, state.remembered]
  )

  /** Remember the user's own numbers on this device (used when the profile has none). */
  const remember = useCallback((input: { heightCm?: string | number | null; weightKg?: string | number | null }) => {
    const next = toRememberedBodyMetrics({
      heightCm: input.heightCm ?? state.remembered?.heightCm,
      weightKg: input.weightKg ?? state.remembered?.weightKg
    })
    if (!next) return
    try {
      Taro.setStorageSync(MY_BODY_METRICS_STORAGE_KEY, next)
    } catch (error) {
      console.warn('[body-metrics] remember failed:', error)
    }
  }, [state.remembered])

  /** Writes the patch to the profile; throws with a user-facing message on failure. */
  const saveToProfile = useCallback(async (patch: ProfileBodyMetricsPatch) => {
    await studentService.updateProfile(patch, { showErrorToast: false })
    setState((prev) => ({ ...prev, profile: applyProfileBodyMetricsPatch(prev.profile, patch) }))
  }, [])

  return { ...state, defaults, remember, saveToProfile }
}
