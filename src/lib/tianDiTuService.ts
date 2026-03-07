/**
 * 天地图 API 服务
 * 提供地理编码、逆地理编码、地图初始化等功能
 * 
 * 天地图开发文档：https://lbs.tianditu.gov.cn/server/MapService.html
 */

// 天地图 API Key
const TIANDITU_KEY = 'c43cd549f84e1cd14f1b5a5b19324b3b';

// 天地图地理编码 API 基础URL
const GEOCODE_API = 'https://api.tianditu.gov.cn/geocoder';

export interface GeocodingResult {
  location: {
    lat: number;   // 纬度
    lon: number;   // 经度
  };
  /** 与天地图 API 返回字段一致 */
  addressComponent?: {
    province?: string;
    city?: string;
    district?: string;
    street?: string;
    street_number?: string;
    address?: string; // 格式化地址
  };
}

export interface ReverseGeocodingResult {
  /** 与天地图 API 返回字段一致 */
  addressComponent: {
    address?: string;
    province?: string;
    city?: string;
    county?: string;
    district?: string;
    street?: string;
    street_number?: string;
    poi?: string;
    [key: string]: string | undefined;
  };
  /** 天地图返回的格式化完整地址（formatted_address / formattedAddress） */
  formatted_address?: string;
}

/**
 * 地理编码：将地址转换为经纬度坐标
 * @param keyWord 请求关键字，应为「省+市+区+详细地址」拼接（无横杠、无分隔符），如 "北京市海淀区莲花池西路28号"
 * @returns 经纬度坐标信息
 */
export async function geocodeAddress(keyWord: string): Promise<GeocodingResult | null> {
  try {
    const dsObj = { keyWord };
    const dsStr = JSON.stringify(dsObj);
    const url = `${GEOCODE_API}?ds=${encodeURIComponent(dsStr)}&tk=${TIANDITU_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    if (!text) return null;
    const data = JSON.parse(text);

    if (data.status === '0' && data.location) {
      return {
        location: {
          lat: parseFloat(data.location.lat),
          lon: parseFloat(data.location.lon)
        },
        addressComponent: data.addressComponent
      };
    }

    console.error('天地图地理编码失败:', data);
    return null;
  } catch (error) {
    console.error('地理编码请求失败:', error);
    return null;
  }
}

/**
 * 逆地理编码：将经纬度坐标转换为地址
 * @param lat 纬度
 * @param lon 经度
 * @returns 地址信息
 */
export async function reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodingResult | null> {
  try {
    const url = `${GEOCODE_API}?postStr={"lon":${lon},"lat":${lat},"ver":1}&type=geocode&tk=${TIANDITU_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    if (!text) return null;
    const data = JSON.parse(text);

    if (data.status === '0' && data.result) {
      const comp = data.result.addressComponent || {};
      return {
        addressComponent: comp,
        formatted_address: data.result.formatted_address ?? data.result.formattedAddress,
      };
    }

    console.error('天地图逆地理编码失败:', data);
    return null;
  } catch (error) {
    console.error('逆地理编码请求失败:', error);
    return null;
  }
}

/**
 * 加载天地图 JavaScript API
 * @returns Promise<boolean> 加载成功返回 true
 */
export function loadTianDiTuScript(): Promise<boolean> {
  return new Promise((resolve) => {
    // 检查是否已经加载
    if (typeof window !== 'undefined' && (window as any).T) {
      setTimeout(() => resolve(true), 100);
      return;
    }
    
    // 创建 script 标签
    const script = document.createElement('script');
    script.src = `https://api.tianditu.gov.cn/api?v=4.0&tk=${TIANDITU_KEY}`;
    script.async = true;
    
    script.onload = () => {
      let attempts = 0;
      const maxAttempts = 50; // 最多等待5秒
      const checkAPI = () => {
        attempts++;
        const T = (window as any).T;
        if (T && T.Map && T.LngLat && T.Marker) {
          resolve(true);
        } else if (attempts < maxAttempts) {
          setTimeout(checkAPI, 100);
        } else {
          console.error('天地图API初始化超时');
          resolve(false);
        }
      };
      checkAPI();
    };
    
    script.onerror = () => {
      console.error('❌ 天地图 API 脚本加载失败');
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * 初始化天地图地图实例
 * @param containerId 地图容器 DOM ID
 * @param center 地图中心点 [经度, 纬度]
 * @param zoom 缩放级别（默认 14）
 * @returns 地图实例
 */
export function initTianDiTuMap(
  containerId: string,
  center: [number, number] = [116.397428, 39.90923], // 默认北京天安门
  zoom: number = 16  // 默认缩放级别调整为16（更详细）
): any {
  if (typeof window === 'undefined' || !(window as any).T) {
    console.error('❌ 天地图 API 未加载');
    return null;
  }

  const T = (window as any).T;
  
  // 验证必需的API组件
  if (!T.Map || !T.LngLat || !T.Control) {
    console.error('❌ 天地图 API 组件不完整', {
      Map: !!T.Map,
      LngLat: !!T.LngLat,
      Control: !!T.Control
    });
    return null;
  }
  
  try {
    const map = new T.Map(containerId);
    if (!map) return null;
    const lngLat = new T.LngLat(center[0], center[1]);
    map.centerAndZoom(lngLat, zoom);
    
    // 启用各种地图交互功能
    map.enableScrollWheelZoom();  // 启用鼠标滚轮缩放
    map.enableDrag();             // 启用地图拖动
    map.enableDoubleClickZoom();  // 启用双击放大
    map.enableKeyboard();         // 启用键盘操作
    map.enableInertia();          // 启用惯性拖动
    return map;
  } catch (error) {
    console.error('❌ 初始化地图时出错:', error);
    return null;
  }
}

/**
 * 在地图上添加标记
 * @param map 地图实例
 * @param position [经度, 纬度]
 * @param options 标记选项
 * @returns 标记实例
 */
export function addMapMarker(
  map: any,
  position: [number, number],
  options?: {
    draggable?: boolean;
    icon?: any;
    title?: string;
  }
): any {
  if (!map || typeof window === 'undefined' || !(window as any).T) {
    return null;
  }

  const T = (window as any).T;
  const marker = new T.Marker(new T.LngLat(position[0], position[1]), {
    draggable: options?.draggable || false,
    title: options?.title,
  });

  // 先挂载到地图，再设置图标（天地图要求标记已在地图上时 setIcon 才生效）
  map.addOverLay(marker);

  if (options?.draggable && typeof marker.enableDrag === 'function') {
    try { marker.enableDrag(); } catch (_) {}
  }

  if (options?.icon && typeof marker.setIcon === 'function') {
    try {
      marker.setIcon(options.icon);
    } catch (e) {
      console.warn('setIcon 失败，使用默认图标:', e);
    }
  }

  return marker;
}

/**
 * 用 Canvas 生成红色图钉 PNG，返回 T.Icon 实例。
 * 比 SVG data URL 兼容性更好（天地图内部用 <img> 加载图标）。
 */
export function createRedMarkerIcon(): any {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  const T = (window as any).T;
  if (!T?.Icon || !T?.Point) return undefined;

  try {
    const W = 32, H = 44;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // 圆形主体（红色）
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = '#e53e3e';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 底部尖角（红色三角形）
    ctx.beginPath();
    ctx.moveTo(W / 2 - 7, W - 4);
    ctx.lineTo(W / 2, H);
    ctx.lineTo(W / 2 + 7, W - 4);
    ctx.fillStyle = '#e53e3e';
    ctx.fill();

    // 中心白色圆点
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const iconUrl = canvas.toDataURL('image/png');
    return new T.Icon({
      iconUrl,
      iconSize: new T.Point(W, H),
      iconAnchor: new T.Point(W / 2, H), // 锚点在底部尖角
    });
  } catch (e) {
    console.warn('创建红色标记图标失败:', e);
    return undefined;
  }
}

/**
 * 移除地图标记
 * @param map 地图实例
 * @param marker 标记实例
 */
export function removeMapMarker(map: any, marker: any): void {
  if (map && marker) {
    map.removeOverLay(marker);
  }
}

/**
 * 清除地图上的所有覆盖物
 * @param map 地图实例
 */
export function clearMapOverlays(map: any): void {
  if (map && map.clearOverLays) {
    map.clearOverLays();
  }
}

/** 默认中心点（北京），在地理编码失败或未选择城市时使用 */
const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923];

/**
 * 通过天地图地理编码接口，根据省/市/区字符串获取中心点经纬度
 * @param cityName 格式："省"、"省-市"或"省-市-区"，如 "江苏省-无锡市-梁溪区"
 * @returns [经度, 纬度]，失败时返回 null
 */
export async function geocodeCityCenter(cityName: string): Promise<[number, number] | null> {
  if (!cityName || !cityName.trim()) return null;
  // 拼接为天地图可识别的地址字符串，如 "江苏省无锡市梁溪区"
  const address = cityName.replace(/-/g, '').trim();
  const result = await geocodeAddress(address);
  if (!result?.location) return null;
  const { lon, lat } = result.location;
  return [lon, lat];
}

/**
 * 根据城市字符串的层级（省/省-市/省-市-区）返回合适的地图缩放级别
 */
export function getCityZoom(cityName: string): number {
  if (!cityName) return 5;
  const depth = cityName.split('-').filter(Boolean).length;
  if (depth >= 3) return 13; // 省-市-区
  if (depth === 2) return 11; // 省-市
  return 7;                   // 省
}

/** 获取默认地图中心（北京），用于初始化或地理编码失败时的回退 */
export function getDefaultCenter(): [number, number] {
  return [...DEFAULT_CENTER];
}

/** 用户提供的哑铃 SVG 路径（viewBox 0 0 1024 1024） */
const DUMBBELL_SVG_PATHS = `<path d="M511.9 152.1m-91.9 0a91.9 91.9 0 1 0 183.8 0 91.9 91.9 0 1 0-183.8 0Z" fill="#13227a"/><path d="M462.3 646.9h99.2c17.7 0 32-14.3 32-32l0.1-303.4c0-17.7-14.3-32-32-32h-99.2c-17.7 0-32 14.3-32 32l-0.1 303.4c0 17.7 14.3 32 32 32z" fill="#13227a"/><path d="M459.2 396.6c-2.2 0-4.3-0.2-6.6-0.5l-183.4-30.5c-19.1-3.2-33.1-19.7-33.1-39.1V103c0-21.9 17.7-39.6 39.6-39.6s39.6 17.7 39.6 39.6v189.9l150.3 25c21.6 3.6 36.2 24 32.6 45.6-3.2 19.3-20 33.1-39 33.1zM564.6 396.6c-19 0-35.8-13.7-39-33.1-3.6-21.6 11-42 32.6-45.6l150.3-25V103c0-21.9 17.7-39.6 39.6-39.6s39.6 17.7 39.6 39.6v223.5c0 19.4-14 35.9-33.1 39.1L571.2 396c-2.2 0.4-4.4 0.6-6.6 0.6zM469.2 964.7c-21.9 0-39.6-17.7-39.6-39.6v-317c0-21.9 17.7-39.6 39.6-39.6 21.9 0 39.6 17.7 39.6 39.6v317c0 21.9-17.7 39.6-39.6 39.6zM554.6 964.7c-21.9 0-39.6-17.7-39.6-39.6v-317c0-21.9 17.7-39.6 39.6-39.6 21.9 0 39.6 17.7 39.6 39.6v317c0 21.9-17.7 39.6-39.6 39.6z" fill="#13227a"/><path d="M984.3 163.2H39.6c-21.9 0-39.6-17.7-39.6-39.6S17.7 84 39.6 84h944.7c21.9 0 39.6 17.7 39.6 39.6s-17.8 39.6-39.6 39.6z" fill="#13227a"/>`;

/** 将 SVG 字符串编码为 data URL（兼容非 ASCII 字符） */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * 使用用户提供的哑铃 SVG 生成 T.Icon 实例，用于单个点位标记。
 */
export function createDumbbellIcon(): any {
  if (typeof window === 'undefined') return undefined;
  const T = (window as any).T;
  if (!T?.Icon || !T?.Point) return undefined;

  try {
    const W = 32, H = 32;
    const svg = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${DUMBBELL_SVG_PATHS}</svg>`;
    return new T.Icon({
      iconUrl: svgToDataUrl(svg),
      iconSize: new T.Point(W, H),
      iconAnchor: new T.Point(W / 2, H / 2),
    });
  } catch (e) {
    console.warn('createDumbbellIcon 失败:', e);
    return undefined;
  }
}

/**
 * 在哑铃 SVG 右上角叠加红色数字徽章，生成聚合点位图标。
 * 用于 T.MarkerClusterer 的 styles 配置。
 */
export function createClusterIcon(count: number): any {
  if (typeof window === 'undefined') return undefined;
  const T = (window as any).T;
  if (!T?.Icon || !T?.Point) return undefined;

  try {
    const label = count > 99 ? '99+' : String(count);
    const fontSize = label.length > 2 ? 7 : 9;
    // 整体画布：哑铃 32×32，徽章半径 10 叠在右上角
    const W = 44, H = 44;
    const svg = `<svg viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <svg x="0" y="10" width="32" height="32" viewBox="0 0 1024 1024">${DUMBBELL_SVG_PATHS}</svg>
  <circle cx="36" cy="9" r="9" fill="#e53e3e" stroke="white" stroke-width="1.5"/>
  <text x="36" y="9" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="sans-serif">${label}</text>
</svg>`;
    return new T.Icon({
      iconUrl: svgToDataUrl(svg),
      iconSize: new T.Point(W, H),
      iconAnchor: new T.Point(16, H / 2 + 5),
    });
  } catch (e) {
    console.warn('createClusterIcon 失败:', e);
    return undefined;
  }
}
