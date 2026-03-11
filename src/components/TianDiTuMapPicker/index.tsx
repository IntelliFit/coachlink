'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from 'primereact/button';
import {
  loadTianDiTuScript,
  initTianDiTuMap,
  addMapMarker,
  createRedMarkerIcon,
  geocodeAddress,
  geocodeCityCenter,
  reverseGeocode,
  getCityZoom,
  getDefaultCenter,
} from '@/lib/tianDiTuService';

/** 可被 AbortController 取消的延迟，用于替代 setTimeout 的异步等待 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

interface TianDiTuMapPickerProps {
  province?: string;
  city?: string;
  county?: string;
  address?: string;        // 详细地址（用于地理编码）
  latitude?: number;       // 初始纬度
  longitude?: number;       // 初始经度
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
  /** 逆地理编码得到的详细地址（拖拽/点击落点后回调） */
  onAddressChange?: (address: string) => void;
  /** 逆地理编码得到的省市区，格式 "省-市-区"（拖拽/点击落点后回调） */
  onCityChange?: (cityValue: string) => void;
  /** 逆地理编码结果一次性回传：省/市/区 + 详细地址（address+poi）+ 经纬度，与后端存储一致。传入经纬度时可与地址一起一次更新，避免「先更新坐标再更新地址」的中间态闪烁。 */
  onReverseGeocode?: (result: { province: string; city: string; county: string; address: string; latitude?: number; longitude?: number }) => void;
  onRelocate?: () => void; // 重新定位回调（调用父组件的自动定位）
  height?: string;         // 地图高度，默认 '400px'
}

/**
 * 天地图地图标点选择组件
 */
const TianDiTuMapPicker: React.FC<TianDiTuMapPickerProps> = ({
  province: provinceProp,
  city: cityProp,
  county: countyProp,
  address,
  latitude,
  longitude,
  onLocationChange,
  onAddressChange,
  onCityChange,
  onReverseGeocode,
  onRelocate,
  height = '400px'
}) => {
  /** 仅请求天地图接口时使用：省/市/区 拼接为无横杠字符串，如 "江苏省无锡市梁溪区" */
  const cityNameForApi = [provinceProp, cityProp, countyProp].filter(Boolean).join('');
  /** 用于 getCityZoom 的层级判断：带横杠，如 "江苏省-无锡市-梁溪区" */
  const cityNameForZoom = [provinceProp, cityProp, countyProp].filter(Boolean).join('-') || '北京市';
  // 为每个实例生成唯一ID
  const mapId = useMemo(() => `tianditu-map-${Math.random().toString(36).substr(2, 9)}`, []);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  // 城市/地址防抖任务可通过 AbortController 取消，避免拖拽后旧任务覆盖标记
  const cityLocateAbortRef = useRef<AbortController | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  // handleGeocode 已自行放置标记，通知同步 effect 跳过本次触发
  const skipSyncEffectRef = useRef(false);
  // 地址是由逆地理编码回填的，跳过本次“地址变化→地理编码”，避免重复请求
  const skipAddressGeocodeRef = useRef(false);
  // 逆地理回填后一段时间内跳过“地址→地理编码”，避免 address+city 两次更新触发 handleGeocode 把标记拉回
  const lastReverseGeocodeTimeRef = useRef(0);
  // 逆地理请求 500ms 防抖：拖拽/点击后只发最后一次
  const reverseGeocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReverseGeocodeRef = useRef<{ lat: number; lon: number } | null>(null);
  // 省市区是由逆地理编码回填的，跳过本次“城市变化→定位到城市中心”，避免拖拽后标记被移走
  const skipCityLocateRef = useRef(false);
  // 标记地图 addOverLay 是否已安全可用（Phase 2 延时结束后）
  const mapReadyRef = useRef(false);
  // 在 Phase 2 之前到达的位置暂存于此，Phase 2 统一消费
  const pendingLatLngRef = useRef<{ lat: number; lon: number } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(
    latitude && longitude ? { lat: latitude, lon: longitude } : null
  );

  /** 根据经纬度调用逆地理编码，将 addressComponent 的 省/市/区 与 详细地址（address+poi）回传给父组件。
   * 天地图返回格式：addressComponent.province/city/county、address、poi 等。500ms 防抖，仅最后一次触发请求。 */
  const fetchAddressAndNotify = (lat: number, lon: number) => {
    pendingReverseGeocodeRef.current = { lat, lon };
    if (reverseGeocodeTimerRef.current) clearTimeout(reverseGeocodeTimerRef.current);
    reverseGeocodeTimerRef.current = setTimeout(() => {
      reverseGeocodeTimerRef.current = null;
      const pending = pendingReverseGeocodeRef.current;
      pendingReverseGeocodeRef.current = null;
      if (!pending) return;
      const { lat: lngLat, lon: lngLon } = pending;
      lastReverseGeocodeTimeRef.current = Date.now();
      reverseGeocode(lngLat, lngLon).then((result) => {
      const ac = result?.addressComponent as Record<string, unknown> | undefined;
      if (!ac && !result?.formatted_address) return;

      const addrPart = (ac?.address ?? '') as string;
      const poiPart = (ac?.poi ?? '') as string;
      const addressStr = [addrPart, poiPart].filter(Boolean).join(' ') || (result?.formatted_address ?? '');

      const str = (v: unknown) => (v != null && v !== '') ? String(v).trim() : '';
      const parents = ac?.parents as Record<string, { name?: string }> | undefined;
      const fromParents = (key: string) => {
        const p = parents?.[key];
        return (p && typeof p === 'object' && typeof p.name === 'string') ? String(p.name).trim() : '';
      };
      const province = str(ac?.province) || fromParents('province') || str((ac as any)?.provinceName);
      let city = str(ac?.city) || fromParents('city') || str((ac as any)?.cityName);
      const county = str(ac?.county) || str(ac?.district) || fromParents('district') || fromParents('county') || str((ac as any)?.area);

      // 直辖市时接口常返回 city 为空，用 province 补全
      const municipalities = ['北京', '天津', '上海', '重庆'];
      if (province && !city && municipalities.some(m => province === m || province === m + '市')) {
        city = province;
      }

      if (onReverseGeocode) {
        skipAddressGeocodeRef.current = true;
        skipCityLocateRef.current = true;
        onReverseGeocode({ province, city, county, address: addressStr, latitude: lngLat, longitude: lngLon });
        return;
      }
      if (addressStr && onAddressChange) {
        skipAddressGeocodeRef.current = true;
        onAddressChange(addressStr);
      }
      const parts = [province, city, county].filter(Boolean);
      if (parts.length > 0 && onCityChange) {
        skipCityLocateRef.current = true;
        onCityChange(parts.join('-'));
      }
    });
    }, 500);
  };
  
  // 加载天地图脚本并初始化地图
  useEffect(() => {
    let eventCleanup: (() => void) | undefined;
    const initAbort = new AbortController();
    const signal = initAbort.signal;

    const initMap = async () => {
      setLoading(true);
      setLoadError(false);

      const loaded = await loadTianDiTuScript();
      if (signal.aborted) return;
      if (!loaded) {
        setLoading(false);
        setLoadError(true);
        return;
      }
      if (!mapContainerRef.current) {
        setLoading(false);
        setLoadError(true);
        return;
      }

      let center: [number, number];
      if (latitude && longitude) {
        center = [longitude, latitude];
      } else if ([provinceProp, cityProp, countyProp].some(Boolean)) {
        center = getDefaultCenter();
      } else {
        center = getDefaultCenter();
      }

      let map: any;
      try {
        map = initTianDiTuMap(mapId, center, 16);
        if (signal.aborted) return;
        if (!map) {
          setLoading(false);
          setLoadError(true);
          return;
        }
        mapRef.current = map;
      } catch (error) {
        setLoading(false);
        setLoadError(true);
        return;
      }

      const runPhase1ControlsAndClick = () => {
        try {
          if (!mapRef.current) return;
          const map = mapRef.current;
          const T = (window as any).T;
          if (!T) {
            setLoadError(true);
            setLoading(false);
            return;
          }
          try {
            if (T.Control?.Zoom) map.addControl(new T.Control.Zoom());
            if (T.Control?.Scale) map.addControl(new T.Control.Scale());
          } catch (e) {}
          if (T.Marker && T.LngLat && T.Event) {
            const handleMapClick = (e: any) => {
              try {
                const lnglat = e.lnglat;
                if (!lnglat) return;
                placeMarker(lnglat.lng, lnglat.lat);
                setCurrentLocation({ lat: lnglat.lat, lon: lnglat.lng });
                skipSyncEffectRef.current = true;
                fetchAddressAndNotify(lnglat.lat, lnglat.lng);
              } catch (err) {
                console.error('处理地图点击失败:', err);
              }
            };
            T.Event.on(map, 'click', handleMapClick);
            eventCleanup = () => {
              try { T.Event.off(map, 'click', handleMapClick); } catch (_) {}
            };
          }
        } catch (err) {
          setLoadError(true);
        } finally {
          setLoading(false);
        }
      };

      const runPhase2InitialMarker = () => {
        mapReadyRef.current = true;
        if (!mapRef.current) return;
        const map = mapRef.current;
        const T = (window as any).T;
        if (!T?.Marker || !T.LngLat) return;
        const target = pendingLatLngRef.current
          ?? (latitude && longitude ? { lat: latitude, lon: longitude } : null);
        if (!target || markerRef.current) return;
        try {
          placeMarker(target.lon, target.lat);
        } catch (err) {
          console.warn('添加初始标记失败:', err);
        }
      };

      await delay(300, signal);
      if (signal.aborted) return;
      runPhase1ControlsAndClick();

      await delay(800, signal);
      if (signal.aborted) return;
      runPhase2InitialMarker();
    };

    initMap().catch((err) => {
      if (signal.aborted) return;
      console.error('❌ initMap 执行出错:', err);
      setLoading(false);
      setLoadError(true);
    });

    return () => {
      initAbort.abort();
      if (eventCleanup) eventCleanup();
      if (mapRef.current) {
        try {
          if (typeof mapRef.current.destroy === 'function') {
            mapRef.current.destroy();
          } else if (mapRef.current.clearOverLays) {
            mapRef.current.clearOverLays();
          }
        } catch (_) {}
        mapRef.current = null;
      }
      mapReadyRef.current = false;
      pendingLatLngRef.current = null;
      cityLocateAbortRef.current?.abort();
      cityLocateAbortRef.current = null;
      geocodeAbortRef.current?.abort();
      geocodeAbortRef.current = null;
      if (markerRef.current) markerRef.current = null;
    };
  }, []);

  /**
   * 公共辅助：移除旧标记，在指定坐标放置新的红色可拖动标记，并更新 markerRef。
   * 仅绑定 dragend：拖拽结束后更新坐标并请求逆地理编码，不占用地图的 mousedown/move/up，地图可正常拖拽。
   */
  const placeMarker = (lon: number, lat: number) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const T = (window as any).T;
    if (!T?.Marker || !T.LngLat) return;

    // 用户通过点击地图或拖拽标记选择了新位置，此时应视为“以标记为准”，
    // 取消任何基于旧城市/旧详细地址排队中的地理编码任务，避免它们稍后把标记拉回去。
    cityLocateAbortRef.current?.abort();
    cityLocateAbortRef.current = null;
    geocodeAbortRef.current?.abort();
    geocodeAbortRef.current = null;

    if (markerRef.current) {
      try { map.removeOverLay(markerRef.current); } catch (_) {}
      markerRef.current = null;
    }

    map.centerAndZoom(new T.LngLat(lon, lat), 16);
    const marker = addMapMarker(map, [lon, lat], {
      draggable: true,
      title: '当前位置，可拖动调整',
      icon: createRedMarkerIcon(),
    });
    if (!marker) return;

    markerRef.current = marker;

    const onDragEnd = () => {
      const pos = marker.getLngLat?.() ?? marker.getPosition?.();
      if (!pos) return;
      const latVal = typeof pos.getLat === 'function' ? pos.getLat() : pos.lat;
      const lngVal = typeof pos.getLng === 'function' ? pos.getLng() : pos.lng;
      if (typeof latVal !== 'number' || typeof lngVal !== 'number') return;
      skipSyncEffectRef.current = true;
      setCurrentLocation({ lat: latVal, lon: lngVal });
      fetchAddressAndNotify(latVal, lngVal);
    };

    try {
      if (typeof marker.addEventListener === 'function') {
        marker.addEventListener('dragend', onDragEnd);
      }
      const T = (window as any).T;
      if (T?.Event?.addListener) {
        T.Event.addListener(marker, 'dragend', onDragEnd);
      } else if (T?.Event?.on) {
        T.Event.on(marker, 'dragend', onDragEnd);
      }
    } catch (_) {}
  };

  // 地理编码：keyWord 为「省+市+区+详细地址」拼接（无横杠），请求天地图接口
  const handleGeocode = async () => {
    if (!mapRef.current) return;
    const provinceCityCounty = [provinceProp, cityProp, countyProp].filter(Boolean).join('');
    if (!provinceCityCounty) return;

    setGeocoding(true);
    try {
      const keyWord = address ? `${provinceCityCounty}${address}` : provinceCityCounty;
      const result = await geocodeAddress(keyWord);

      if (result && mapRef.current) {
        const { lat, lon } = result.location;

        placeMarker(lon, lat);
        setCurrentLocation({ lat, lon });
        // 通知父组件前先设置跳过标志，防止同步 effect 再次新建标记
        skipSyncEffectRef.current = true;
        onLocationChange({ latitude: lat, longitude: lon });
      }
    } catch (error) {
      console.error('地理编码失败:', error);
    } finally {
      setGeocoding(false);
    }
  };

  // Effect 1：省/市/区变化 → 异步防抖后请求天地图（无横杠拼接）获取中心点，再定位并放置标记
  useEffect(() => {
    if (skipCityLocateRef.current) {
      skipCityLocateRef.current = false;
      return;
    }

    const targetCityForApi = cityNameForApi || '北京市';
    const controller = new AbortController();
    cityLocateAbortRef.current = controller;
    const signal = controller.signal;

    (async () => {
      await delay(500, signal);
      if (signal.aborted) return;
      const center = await geocodeCityCenter(targetCityForApi);
      if (signal.aborted || !center) return;
      const [lon, lat] = center;
      const zoom = getCityZoom(cityNameForZoom);

      if (!mapRef.current || !mapReadyRef.current) {
        pendingLatLngRef.current = { lat, lon };
        return;
      }
      skipSyncEffectRef.current = true;
      placeMarker(lon, lat);
      setCurrentLocation({ lat, lon });
      onLocationChange({ latitude: lat, longitude: lon });
      const T = (window as any).T;
      if (mapRef.current) {
        mapRef.current.centerAndZoom(new T.LngLat(lon, lat), zoom);
      }
    })();

    return () => {
      controller.abort();
      if (cityLocateAbortRef.current === controller) {
        cityLocateAbortRef.current = null;
      }
    };
  }, [provinceProp, cityProp, countyProp]);

  // Effect 2：详细地址变化 → 异步防抖后地理编码（省/市/区 无横杠 + 地址），结果覆盖标记
  useEffect(() => {
    if (skipAddressGeocodeRef.current) {
      skipAddressGeocodeRef.current = false;
      return;
    }
    const msSinceReverse = Date.now() - lastReverseGeocodeTimeRef.current;
    if (msSinceReverse < 500) return;
    if (!cityNameForApi || !address) return;

    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    const signal = controller.signal;

    (async () => {
      await delay(500, signal);
      if (signal.aborted) return;
      await handleGeocode();
    })();

    return () => {
      controller.abort();
      if (geocodeAbortRef.current === controller) {
        geocodeAbortRef.current = null;
      }
    };
  }, [provinceProp, cityProp, countyProp, address]);

  // 卸载时清除逆地理 500ms 防抖定时器
  useEffect(() => {
    return () => {
      if (reverseGeocodeTimerRef.current) {
        clearTimeout(reverseGeocodeTimerRef.current);
        reverseGeocodeTimerRef.current = null;
      }
    };
  }, []);

  // 当父组件传入的选中位置（latitude/longitude）变化时，同步更新地图上的可拖动标记
  useEffect(() => {
    // lat/lon 被清空（城市切换时父组件重置）：移除旧标记并清空坐标显示
    if (latitude == null || longitude == null) {
      if (markerRef.current && mapRef.current) {
        try { mapRef.current.removeOverLay(markerRef.current); } catch (_) {}
        markerRef.current = null;
      }
      pendingLatLngRef.current = null;
      setCurrentLocation(null);
      return;
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
    const next = { lat: latitude, lon: longitude };

    // handleGeocode 已自行放置标记并通知了父组件，跳过本次同步避免重复创建
    if (skipSyncEffectRef.current) {
      skipSyncEffectRef.current = false;
      return;
    }

    // 如果地图渲染层还未就绪（Phase 2 未到），把坐标暂存；Phase 2 会消费它
    if (!mapReadyRef.current || !mapRef.current) {
      pendingLatLngRef.current = next;
      return;
    }

    try {
      placeMarker(longitude, latitude);
      setCurrentLocation({ lat: latitude, lon: longitude });
    } catch (e) {
      console.warn('同步选中位置标记失败:', e);
    }
  }, [latitude, longitude]);

  return (
    <div className="space-y-3">
      {/* 地图容器：不使用 overflow-hidden，防止裁剪地图边缘处的标记图标 */}
      <div className="relative rounded-lg border border-surface-200" style={{ overflow: 'visible' }}>
        <div
          ref={mapContainerRef}
          id={mapId}
          style={{ 
            width: '100%', 
            height,
            borderRadius: 'inherit',
            overflow: 'hidden',          // 裁剪瓦片到圆角，但不影响标记层
            pointerEvents: loading || loadError ? 'none' : 'auto',
          }}
          className="bg-surface-100"
        />
        
        {loading && !loadError ? (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-surface-50 bg-opacity-75"
              style={{ zIndex: 10, pointerEvents: 'auto', borderRadius: 'inherit' }}
            >
              <div className="text-center">
                <i className="pi pi-spin pi-spinner text-3xl text-primary-500 mb-2"></i>
                <p className="text-sm text-surface-600">加载地图中...</p>
              </div>
            </div>
        ) : null}
        
        {loadError && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-surface-50"
            style={{ zIndex: 10, pointerEvents: 'auto', borderRadius: 'inherit' }}
          >
            <div className="text-center p-6">
              <i className="pi pi-exclamation-triangle text-4xl text-amber-500 mb-3"></i>
              <p className="text-sm text-surface-600 mb-2">地图加载失败</p>
              <p className="text-xs text-surface-400">可以继续填写其他信息，位置将通过经纬度保存</p>
            </div>
          </div>
        )}
      </div>

      {/* 操作提示和按钮 */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-surface-500">
          <i className="pi pi-info-circle mr-1"></i>
          当前选中位置已用标记显示，可点击地图打点或按住标记拖动微调
        </div>
        
        {onRelocate && (
          <Button
            label="重新定位"
            icon="pi pi-refresh"
            size="small"
            text
            onClick={onRelocate}
            tooltip="获取当前位置并自动填充"
            tooltipOptions={{ position: 'left' }}
          />
        )}
      </div>

      {/* 显示当前坐标 */}
      {currentLocation && (
        <div className="text-xs text-surface-400 bg-surface-50 rounded p-2 font-mono">
          坐标：{currentLocation.lon.toFixed(6)}, {currentLocation.lat.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default TianDiTuMapPicker;
