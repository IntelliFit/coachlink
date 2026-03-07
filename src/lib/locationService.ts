/**
 * 位置定位服务
 * 支持浏览器定位和IP定位两种方式
 */

import { reverseGeocode } from './tianDiTuService';

export interface LocationResult {
  latitude: number;
  longitude: number;
  city?: string;      // 格式：省-市-区
  address?: string;   // 详细地址
  source: 'browser' | 'ip' | 'manual'; // 定位来源
}

/**
 * 通过浏览器Geolocation API获取精确位置
 * 优先使用此方法，精度最高
 */
async function getBrowserLocation(): Promise<LocationResult | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('浏览器不支持定位');
      resolve(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log('浏览器定位超时');
      resolve(null);
    }, 10000); // 10秒超时

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(timeoutId);
        const { latitude, longitude } = position.coords;
        
        console.log('浏览器定位成功:', { latitude, longitude });

        // 使用天地图逆地理编码获取地址信息
        try {
          const geoResult = await reverseGeocode(latitude, longitude);
          
          if (geoResult) {
            // 组装城市字符串（省-市-区）
            const ac: any = geoResult.addressComponent || {};
            let province = ac.province || '';
            let city = ac.city || '';
            // 天地图有的返回字段名为 county，有的为 district，这里做兼容
            let district = ac.district || ac.county || '';
            
            // 处理直辖市情况（北京市、上海市、天津市、重庆市）
            // 这些城市的province和city相同，需要统一格式
            if (province && city && province === city) {
              // 直辖市：保持 "北京市-北京市-朝阳区" 格式
              // 这样与cityData.ts中的格式一致
            }
            
            // 过滤空值并组装
            const cityParts = [province, city, district].filter(Boolean);
            const cityStr = cityParts.length >= 3 ? cityParts.join('-') : '';
            
            // 使用 address 作为详细地址
            const address = geoResult.addressComponent?.address || '';

            resolve({
              latitude,
              longitude,
              city: cityStr || undefined,
              address: address || undefined,
              source: 'browser'
            });
          } else {
            // 逆地理编码失败，只返回坐标
            console.log('逆地理编码返回为空');
            resolve({
              latitude,
              longitude,
              source: 'browser'
            });
          }
        } catch (error) {
          console.error('逆地理编码失败:', error);
          resolve({
            latitude,
            longitude,
            source: 'browser'
          });
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        console.log('浏览器定位失败:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * 通过IP地址获取粗略位置（备选方案）
 * 使用免费的IP定位服务
 */
async function getIPLocation(): Promise<LocationResult | null> {
  try {
    // 使用 ipapi.co 服务（免费，每天1000次）
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('IP定位服务响应失败');
    }

    const text = await response.text();
    if (!text) return null;
    const data = JSON.parse(text);
    
    if (data.latitude && data.longitude) {
      console.log('IP定位成功:', data);

      // 组装城市字符串
      // ipapi.co 返回的字段：country_name, region, city
      const province = data.region || '';
      const city = data.city || '';
      
      // 中国的话，尝试用天地图逆地理编码获取更详细的信息
      if (data.country_code === 'CN') {
        try {
          const geoResult = await reverseGeocode(data.latitude, data.longitude);
          
          if (geoResult) {
            const ac: any = geoResult.addressComponent || {};
            let province = ac.province || '';
            let city = ac.city || '';
            // 同样兼容 county / district 两种字段名
            let district = ac.district || ac.county || '';
            
            // 处理直辖市情况
            if (province && city && province === city) {
              // 直辖市格式统一
            }
            
            // 过滤空值并组装
            const cityParts = [province, city, district].filter(Boolean);
            const cityStr = cityParts.length >= 3 ? cityParts.join('-') : '';
            
            // 使用 address 作为详细地址
            const address = geoResult.addressComponent?.address || '';

            return {
              latitude: data.latitude,
              longitude: data.longitude,
              city: cityStr || undefined,
              address: address || undefined,
              source: 'ip'
            };
          }
        } catch (error) {
          console.error('天地图逆地理编码失败:', error);
        }
      }

      // 如果不是中国或逆地理编码失败，返回基本信息
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        city: province && city ? `${province}-${city}` : undefined,
        source: 'ip'
      };
    }

    return null;
  } catch (error) {
    console.error('IP定位失败:', error);
    return null;
  }
}

/**
 * 获取当前位置（自动选择最佳方式）
 * 优先使用浏览器定位，失败后使用IP定位
 * 
 * @param preferBrowser 是否优先使用浏览器定位（默认true）
 * @returns 位置信息，如果所有方式都失败则返回null
 */
export async function getCurrentLocation(preferBrowser: boolean = true): Promise<LocationResult | null> {
  if (preferBrowser) {
    // 优先尝试浏览器定位
    console.log('尝试浏览器定位...');
    const browserLocation = await getBrowserLocation();
    
    if (browserLocation) {
      console.log('使用浏览器定位结果');
      return browserLocation;
    }

    // 浏览器定位失败，回退到IP定位
    console.log('浏览器定位失败，尝试IP定位...');
  }

  // 使用IP定位
  const ipLocation = await getIPLocation();
  
  if (ipLocation) {
    console.log('使用IP定位结果');
    return ipLocation;
  }

  console.log('所有定位方式都失败');
  return null;
}

/**
 * 仅使用IP定位（不弹出浏览器权限请求）
 */
export async function getIPLocationOnly(): Promise<LocationResult | null> {
  return getIPLocation();
}

/**
 * 仅使用浏览器定位
 */
export async function getBrowserLocationOnly(): Promise<LocationResult | null> {
  return getBrowserLocation();
}

/**
 * 解析城市字符串为省市区
 * @param cityStr 格式：省-市-区
 */
export function parseCityString(cityStr: string): {
  province: string;
  city: string;
  district: string;
} {
  const parts = cityStr.split('-');
  return {
    province: parts[0] || '',
    city: parts[1] || '',
    district: parts[2] || ''
  };
}

/**
 * 检查浏览器是否支持定位
 */
export function isGeolocationSupported(): boolean {
  return 'geolocation' in navigator;
}
