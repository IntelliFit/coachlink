'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  registerSw,
  requestPermissionAndSubscribe,
  getNotificationPermission,
  isPushSupported,
  type PushPermission,
} from '@/lib/swRegistration';

export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>('default');
  const [pushLoading, setPushLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    setPermission(getNotificationPermission());
  }, []);

  const requestAndSubscribe = useCallback(async () => {
    if (!isPushSupported()) return;
    setPushLoading(true);
    setError(null);
    const result = await requestPermissionAndSubscribe();
    setPushLoading(false);
    setPermission(getNotificationPermission());
    if (!result.ok) {
      setError(result.reason ?? '请求失败');
      return result;
    }
    return result;
  }, []);

  return { supported, permission, pushLoading, error, requestAndSubscribe };
}
