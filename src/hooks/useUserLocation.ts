'use client';

import { useState, useEffect } from 'react';
import { getCurrentLocation } from '@/lib/locationService';
import type { UserLocation } from '@/lib/distanceUtils';

/**
 * 无感知获取用户位置：优先浏览器定位，拒绝或失败时回退 IP 定位。
 * 不弹 toast，用于发现/搜索页展示与教练距离。
 */
export function useUserLocation(): {
  userLocation: UserLocation | null;
  loading: boolean;
} {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCurrentLocation(true)
      .then((res) => {
        if (cancelled) return;
        if (res) {
          setUserLocation({
            latitude: res.latitude,
            longitude: res.longitude,
            city: res.city,
          });
        } else {
          setUserLocation(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUserLocation(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { userLocation, loading };
}
