/**
 * 距离计算与教练卡片距离展示文案
 */

export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string; // 省-市-区
}

export interface CoachLocation {
  latitude?: number | null;
  longitude?: number | null;
  province?: string | null;
  city?: string | null;
  county?: string | null;
}

/** 地球半径（km），用于 Haversine 公式 */
const R = 6371;

/**
 * Haversine 计算两点距离（km）
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 教练是否有经纬度 */
export function coachHasCoords(c: CoachLocation): boolean {
  return (
    typeof c.latitude === 'number' &&
    typeof c.longitude === 'number' &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude)
  );
}

/** 教练是否有省/市/区任一（用于无定位时显示城市） */
export function coachHasCity(c: CoachLocation): boolean {
  return !!(c.province || c.city || c.county);
}

/** 取教练城市展示名：优先“市”，否则省，再否则省+市 */
export function coachCityDisplay(c: CoachLocation): string {
  if (c.city) return c.city;
  if (c.province) return c.province;
  const parts = [c.province, c.city, c.county].filter(Boolean);
  return parts.length ? parts.join('') : '';
}

/** 用户城市字符串是否与教练同城（省+市一致） */
export function isSameCity(userCityStr: string | undefined, coach: CoachLocation): boolean {
  if (!userCityStr || !coach.province || !coach.city) return false;
  const parts = userCityStr.split('-').filter(Boolean);
  const userProvince = parts[0] || '';
  const userCity = parts[1] || '';
  return userProvince === coach.province && userCity === coach.city;
}

/** 基于经纬度的“附近”判断（用于同城筛选兜底） */
export function isNearbyByCoords(
  userLocation: UserLocation | null,
  coach: CoachLocation,
  maxKm: number = 30
): boolean {
  if (!userLocation || !coachHasCoords(coach)) return false;
  const km = haversineDistanceKm(
    userLocation.latitude,
    userLocation.longitude,
    coach.latitude!,
    coach.longitude!
  );
  return Number.isFinite(km) && km <= maxKm;
}

/**
 * 搜索页“同城”判定：
 * 1) 优先按省+市一致；
 * 2) 若教练未完善省市，但与用户距离很近（默认 30km 内），也视为同城兜底。
 */
export function isSameCityForFilter(
  userLocation: UserLocation | null,
  coach: CoachLocation
): boolean {
  if (!userLocation) return false;
  if (isSameCity(userLocation.city, coach)) return true;
  return isNearbyByCoords(userLocation, coach, 30);
}

/** 用户所在区/县是否与教练一致（省+市+区 均一致时显示同城角标） */
export function isSameCounty(userLocation: UserLocation | null, coach: CoachLocation): boolean {
  if (!userLocation?.city || !coach.province || !coach.city || !coach.county) return false;
  const parts = userLocation.city.split('-').filter(Boolean);
  const userProvince = parts[0] || '';
  const userCity = parts[1] || '';
  const userCounty = parts[2] || '';
  return userProvince === coach.province && userCity === coach.city && userCounty === coach.county;
}

/**
 * 根据用户位置与教练位置生成展示文案（右下角）
 * - 教练未填地理位置：返回空字符串，不展示
 * - 无定位权限（userLocation 为 null）：只展示教练城市；教练无城市也不展示
 * - 有定位：按距离 <1km / 1–100km / >100km 规则展示
 */
export function formatCoachDistance(
  userLocation: UserLocation | null,
  coach: CoachLocation
): string {
  if (!coachHasCity(coach) && !coachHasCoords(coach)) return '';

  const cityDisplay = coachCityDisplay(coach);
  if (!userLocation) {
    return cityDisplay || '';
  }

  if (!coachHasCoords(coach)) {
    return cityDisplay || '';
  }

  const km = haversineDistanceKm(
    userLocation.latitude,
    userLocation.longitude,
    coach.latitude!,
    coach.longitude!
  );

  if (km < 1) {
    if (km < 0.1) return '100m内';
    const meters = Math.round(km * 1000);
    if (meters < 1000) return `${meters}m`;
    return '1km内';
  }
  if (km <= 100) {
    return `${km.toFixed(1)}km`;
  }
  if (isSameCity(userLocation.city, coach)) return '同城';
  return cityDisplay || '';
}
