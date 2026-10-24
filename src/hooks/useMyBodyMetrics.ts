"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MY_BODY_METRICS_STORAGE_KEY,
  applyProfileBodyMetricsPatch,
  parseRememberedBodyMetrics,
  readProfileBodyMetrics,
  readProfileGender,
  resolveBodyMetricsDefaults,
  toRememberedBodyMetrics,
  type BodyMetrics,
  type BodyMetricsDefaults,
  type ProfileBodyMetricsPatch,
} from "@coachlink/core/src/bodyMetrics";

interface MyBodyMetricsState {
  /** True once the profile request settled (signed out or failed also counts). */
  loaded: boolean;
  signedIn: boolean;
  profile: BodyMetrics;
  /** Profile gender, for formulas that need it (null when unknown). */
  gender: "male" | "female" | null;
  remembered: BodyMetrics | null;
}

const EMPTY: BodyMetrics = { heightCm: null, weightKg: null };

function readRemembered(): BodyMetrics | null {
  try {
    return parseRememberedBodyMetrics(window.localStorage.getItem(MY_BODY_METRICS_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * The signed-in user's own height/weight for tools that "measure yourself by default".
 * Never redirects to login: signed-out visitors simply get empty defaults.
 */
export function useMyBodyMetrics() {
  const [state, setState] = useState<MyBodyMetricsState>({
    loaded: false,
    signedIn: false,
    profile: EMPTY,
    gender: null,
    remembered: null,
  });

  useEffect(() => {
    let cancelled = false;
    const remembered = readRemembered();
    const load = async () => {
      try {
        const res = await fetch("/api/user/get-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ loaded: true, signedIn: false, profile: EMPTY, gender: null, remembered });
          return;
        }
        const payload = await res.json();
        if (cancelled) return;
        setState({
          loaded: true,
          signedIn: true,
          profile: readProfileBodyMetrics(payload?.data?.profile),
          gender: readProfileGender(payload?.data?.profile),
          remembered,
        });
      } catch (error) {
        console.warn("[body-metrics] load profile failed:", error);
        if (!cancelled) setState({ loaded: true, signedIn: false, profile: EMPTY, gender: null, remembered });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaults: BodyMetricsDefaults = useMemo(
    () => resolveBodyMetricsDefaults(state.profile, state.remembered),
    [state.profile, state.remembered],
  );

  /** Remember the user's own numbers on this device (used when the profile has none). */
  const remember = useCallback((input: { heightCm?: string | number | null; weightKg?: string | number | null }) => {
    const next = toRememberedBodyMetrics({
      heightCm: input.heightCm ?? state.remembered?.heightCm,
      weightKg: input.weightKg ?? state.remembered?.weightKg,
    });
    if (!next) return;
    try {
      window.localStorage.setItem(MY_BODY_METRICS_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("[body-metrics] remember failed:", error);
    }
  }, [state.remembered]);

  /** Writes the patch to the profile; throws with a user-facing message on failure. */
  const saveToProfile = useCallback(async (patch: ProfileBodyMetricsPatch) => {
    const res = await fetch("/api/user/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.success === false) {
      throw new Error(payload?.message || "保存到个人资料失败，请稍后重试");
    }
    setState((prev) => ({ ...prev, profile: applyProfileBodyMetricsPatch(prev.profile, patch) }));
  }, []);

  return { ...state, defaults, remember, saveToProfile };
}
