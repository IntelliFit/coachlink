'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  loadTianDiTuScript,
  initTianDiTuMap,
  addMapMarker,
  createRedMarkerIcon,
} from '@/lib/tianDiTuService';

interface TianDiTuMapViewerProps {
  latitude: number;
  longitude: number;
  /** 地图高度，默认移动端友好：min(40vh, 280px)，桌面端 320px */
  height?: string;
  className?: string;
}

/**
 * 只读地图展示：在给定经纬度显示一个标记，无拖拽选点。用于教练主页「在地图中查看」。
 */
const TianDiTuMapViewer: React.FC<TianDiTuMapViewerProps> = ({
  latitude,
  longitude,
  height,
  className = '',
}) => {
  const mapId = useMemo(() => `tianditu-viewer-${Math.random().toString(36).substr(2, 9)}`, []);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const center: [number, number] = [longitude, latitude];

    const initMap = async () => {
      setLoading(true);
      setLoadError(false);

      const loaded = await loadTianDiTuScript();
      if (!loaded) {
        setLoading(false);
        setLoadError(true);
        return;
      }

      const map = initTianDiTuMap(mapId, center, 16);
      if (!map) {
        setLoading(false);
        setLoadError(true);
        return;
      }

      mapRef.current = map;

      try {
        const T = (window as any).T;
        if (T?.Control?.Zoom) map.addControl(new T.Control.Zoom());
        if (T?.Control?.Scale) map.addControl(new T.Control.Scale());
      } catch (_) {}

      setLoading(false);

      // 延迟添加标记，确保地图瓦片渲染后再 addOverLay（与 TianDiTuMapPicker 一致）
      phaseTimerRef.current = setTimeout(() => {
        if (!mapRef.current) return;
        const icon = createRedMarkerIcon();
        const marker = addMapMarker(mapRef.current, center, {
          draggable: false,
          icon: icon ?? undefined,
        });
        if (marker) markerRef.current = marker;
      }, 600);
    };

    initMap();

    return () => {
      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
      try {
        const map = mapRef.current;
        if (markerRef.current && map?.removeOverLay) map.removeOverLay(markerRef.current);
        if (typeof map?.destroy === 'function') map.destroy();
      } catch (_) {}
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [mapId, latitude, longitude]);

  const styleHeight = height ?? 'min(40vh, 280px)';

  return (
    <div className={`relative w-full min-w-[320px] rounded-xl overflow-hidden border border-surface-200 bg-surface-50 ${className}`} style={{ minHeight: 120 }}>
      <div
        id={mapId}
        className="w-full bg-surface-100"
        style={{ height: styleHeight, minHeight: 120 }}
      />
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-surface-100/80"
          style={{ height: styleHeight, minHeight: 120 }}
        >
          <span className="text-sm text-surface-500">加载地图中…</span>
        </div>
      )}
      {loadError && !loading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-surface-100 text-surface-500 text-sm"
          style={{ height: styleHeight, minHeight: 120 }}
        >
          地图加载失败，请稍后重试
        </div>
      )}
    </div>
  );
};

export default TianDiTuMapViewer;
