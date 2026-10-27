'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    loadTianDiTuScript,
    initTianDiTuMap,
    createDumbbellIcon,
    createClusterIcon,
} from '@/lib/tianDiTuService';
import { ProgressSpinner } from 'primereact/progressspinner';
import { toTianDiTuCoordinates, type LocationCoordinateSystem } from '@coachlink/core';

interface MapPin {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    country?: string | null;
    coordinate_system?: LocationCoordinateSystem | null;
}

interface Props {
    className?: string;
}

/**
 * 全量单杠位置地图视图
 *
 * - 从 /api/streetlifting-index/locations/map-pins 拉取全量坐标
 * - 用哑铃图标标注每个点位
 * - 通过 T.MarkerClusterer 实现缩小合并、放大分散的聚合效果
 * - 点击单个点位显示地点名称信息窗
 */
export default function TianDiTuLocationsMap({ className }: Props) {
    // 每次挂载生成新 ID，避免组件重挂时 TianDiTu 访问已卸载的旧 DOM 节点
    const mapId = useMemo(() => `tianditu-lmap-${Math.random().toString(36).substr(2, 9)}`, []);
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const clustererRef = useRef<any>(null);
    const infoWindowRef = useRef<any>(null);
    const abortRef = useRef<AbortController | null>(null);

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [pinCount, setPinCount] = useState<number>(0);

    useEffect(() => {
        const ac = new AbortController();
        abortRef.current = ac;

        const delay = (ms: number) =>
            new Promise<void>((res, rej) => {
                const t = setTimeout(res, ms);
                ac.signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted')); });
            });

        const run = async () => {
            try {
                // ── 1. 加载天地图脚本 ──────────────────────────────────────────
                await loadTianDiTuScript();
                if (ac.signal.aborted) return;

                await delay(300);
                if (ac.signal.aborted) return;

                // ── 2. 初始化地图（中国中心，zoom 5）──────────────────────────
                // 清空容器内残留的 TianDiTu DOM，防止重挂时 parentNode 报错
                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                }
                const map = initTianDiTuMap(mapId, [105, 35], 5);
                if (!map) { setStatus('error'); return; }
                mapRef.current = map;

                const T = (window as any).T;

                // 添加缩放控件
                await delay(200);
                if (ac.signal.aborted) return;
                try {
                    map.addControl(new T.Control.Zoom());
                } catch (_) {}

                // ── 3. 拉取全量坐标数据 ────────────────────────────────────────
                const res = await fetch('/api/streetlifting-index/locations/map-pins', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: ac.signal,
                });
                const json = await res.json();
                if (ac.signal.aborted) return;

                // Mini-program points are stored in WeChat GCJ-02; Tianditu draws WGS84.
                const pins: MapPin[] = ((json?.data ?? []) as MapPin[]).map(toTianDiTuCoordinates);
                setPinCount(pins.length);

                if (pins.length === 0) { setStatus('ready'); return; }

                // ── 4. 自定义聚合渲染 ──────────────────────────────────────────
                // 放弃 T.MarkerClusterer（不稳定），改用自定义网格聚合：
                // 监听 zoomend/moveend，按像素距离分组，手动渲染单点或聚合点。
                // addOverLay → setIcon 顺序完全由我们控制，保证图标可见。
                const dumbbellIcon = createDumbbellIcon();

                /** 当前渲染在地图上的所有 overlay，每次 recluster 前清除 */
                let activeOverlays: any[] = [];

                const recluster = () => {
                    // 清除上一次渲染
                    for (const o of activeOverlays) {
                        try { map.removeOverLay(o); } catch (_) {}
                    }
                    activeOverlays = [];

                    // 用像素网格对 pin 分组（网格边长 64px）
                    const GRID = 64;
                    const grid = new Map<string, { sumLon: number; sumLat: number; items: MapPin[] }>();

                    for (const pin of pins) {
                        const lngLat = new T.LngLat(pin.longitude, pin.latitude);
                        let px = 0, py = 0;
                        try {
                            // TianDiTu 4.0 API：lnglatToLayerPoint（注意小写 a）
                            const pt = map.lnglatToLayerPoint
                                ? map.lnglatToLayerPoint(lngLat)
                                : map.lngLatToLayerPoint?.(lngLat);
                            if (pt) { px = pt.x; py = pt.y; }
                        } catch (_) {}

                        const key = `${Math.floor(px / GRID)},${Math.floor(py / GRID)}`;
                        if (!grid.has(key)) grid.set(key, { sumLon: 0, sumLat: 0, items: [] });
                        const cell = grid.get(key)!;
                        cell.items.push(pin);
                        cell.sumLon += pin.longitude;
                        cell.sumLat += pin.latitude;
                    }

                    // 渲染每个格子
                    for (const cell of grid.values()) {
                        const avgLon = cell.sumLon / cell.items.length;
                        const avgLat = cell.sumLat / cell.items.length;
                        const centerLngLat = new T.LngLat(avgLon, avgLat);

                        if (cell.items.length === 1) {
                            // 单点：哑铃图标
                            const pin = cell.items[0];
                            const marker = new T.Marker(new T.LngLat(pin.longitude, pin.latitude));
                            map.addOverLay(marker);
                            if (dumbbellIcon) { try { marker.setIcon(dumbbellIcon); } catch (_) {} }
                            marker.addEventListener('click', () => {
                                if (!infoWindowRef.current) {
                                    infoWindowRef.current = new T.InfoWindow('', { closeButton: true });
                                }
                                const iw = infoWindowRef.current;
                                iw.setContent(`<div style="font-size:13px;font-weight:600;padding:4px 6px">${pin.name}</div>`);
                                marker.openInfoWindow(iw);
                            });
                            activeOverlays.push(marker);
                        } else {
                            // 聚合点：哑铃 + 数字徽章
                            const count = cell.items.length;
                            const clusterMarker = new T.Marker(centerLngLat);
                            map.addOverLay(clusterMarker);
                            const clusterIcon = createClusterIconForCount(count, T);
                            if (clusterIcon) { try { clusterMarker.setIcon(clusterIcon); } catch (_) {} }
                            clusterMarker.addEventListener('click', () => {
                                if (!infoWindowRef.current) {
                                    infoWindowRef.current = new T.InfoWindow('', { closeButton: true });
                                }
                                const iw = infoWindowRef.current;
                                const names = cell.items.slice(0, 5).map(p => `· ${p.name}`).join('<br/>');
                                const more = count > 5 ? `<br/><span style="color:#666">…等${count}个点位</span>` : '';
                                iw.setContent(`<div style="font-size:13px;font-weight:600;padding:4px 6px;line-height:1.8">${names}${more}</div>`);
                                clusterMarker.openInfoWindow(iw);
                            });
                            activeOverlays.push(clusterMarker);
                        }
                    }
                };

                // 初始渲染
                recluster();

                // 缩放 / 平移后重新聚合
                map.addEventListener('zoomend', recluster);
                map.addEventListener('moveend', recluster);

                // 将 recluster 清理函数挂到 clustererRef 供 cleanup 使用
                clustererRef.current = {
                    clearMarkers: () => {
                        map.removeEventListener('zoomend', recluster);
                        map.removeEventListener('moveend', recluster);
                        for (const o of activeOverlays) {
                            try { map.removeOverLay(o); } catch (_) {}
                        }
                        activeOverlays = [];
                    },
                };

                setStatus('ready');
            } catch (e: any) {
                if (e?.name === 'AbortError' || e?.message === 'aborted') return;
                console.error('[TianDiTuLocationsMap]', e);
                setStatus('error');
            }
        };

        run();

        return () => {
            ac.abort();
            if (clustererRef.current) {
                try { clustererRef.current.clearMarkers?.(); } catch (_) {}
                clustererRef.current = null;
            }
            if (mapRef.current) {
                try {
                    if (typeof mapRef.current.destroy === 'function') {
                        mapRef.current.destroy();
                    } else {
                        mapRef.current.clearOverLays();
                    }
                } catch (_) {}
                mapRef.current = null;
            }
            // 清空容器，彻底移除 TianDiTu 注入的 DOM，防止下次挂载时 parentNode 报错
            if (containerRef.current) {
                try { containerRef.current.innerHTML = ''; } catch (_) {}
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={`relative w-full h-full ${className ?? ''}`}>
            {/* 地图容器 */}
            <div id={mapId} ref={containerRef} className="w-full h-full" />

            {/* 加载遮罩：地图脚本加载 + 坐标请求 + marker 渲染完成前持续展示 */}
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-900/60 backdrop-blur-sm z-20">
                    <div className="flex flex-col items-center gap-4 bg-surface-0 rounded-3xl px-10 py-8 shadow-2xl">
                        <ProgressSpinner style={{ width: '48px', height: '48px' }} className="text-primary-500" strokeWidth="4" />
                        <div className="text-center space-y-1">
                            <div className="text-sm font-bold text-surface-900">正在初始化地图</div>
                            <div className="text-xs text-surface-500">正在获取单杠点位数据…</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 错误状态 */}
            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="text-center space-y-2">
                        <i className="pi pi-exclamation-triangle text-3xl text-amber-500" />
                        <div className="text-sm text-surface-600">地图加载失败，请刷新重试</div>
                    </div>
                </div>
            )}

            {/* 右下角点位统计 */}
            {status === 'ready' && pinCount > 0 && (
                <div className="absolute bottom-4 right-4 z-10 bg-surface-900/75 text-surface-0 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
                    共 {pinCount} 个训练点
                </div>
            )}
        </div>
    );
}

/**
 * 创建聚合点图标（哑铃 + 右上角数字徽章）。
 * 走 addOverLay → setIcon 路径，所以直接复用 tianDiTuService 里的 createClusterIcon。
 */
function createClusterIconForCount(count: number, _T: any): any {
    return createClusterIcon(count);
}
