'use client';

import { useEffect } from 'react';
import { toTianDiTuCoordinates } from '@coachlink/core';
import {
    clusterMapPoints,
    MIN_PICK_ZOOM,
    parseTianDiTuAddress,
    type MapBridgeCommand,
    type MapBridgeEvent,
    type MapBridgePin,
} from '@coachlink/core/src/locationMapBridge';
import {
    createClusterIcon,
    createDumbbellIcon,
    createRedMarkerIcon,
    initTianDiTuMap,
    loadTianDiTuScript,
    reverseGeocode,
} from '@/lib/tianDiTuService';

const MAP_ID = 'coachlink-embed-map';
const CLUSTER_GRID_PX = 64;
const GEOCODE_TIMEOUT_MS = 8000;
const USER_DOT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8" fill="#2F80ED" stroke="#fff" stroke-width="3"/></svg>';

declare global {
    interface Window {
        ReactNativeWebView?: { postMessage: (message: string) => void };
        __coachlinkMap?: { receive: (command: MapBridgeCommand) => void };
    }
}

function post(event: MapBridgeEvent) {
    window.ReactNativeWebView?.postMessage(JSON.stringify(event));
}

/**
 * 给 APP 内嵌的单杠地图（APP 端 LocationMapView 用 WebView 打开）。
 * mode=pick 是选点，其余是浏览点位。协议见 packages/core/src/locationMapBridge.ts。
 * 点位由 APP 传入，这样地图和 APP 的器材筛选用的是同一份数据。
 */
export default function EmbedLocationsMapPage() {
    useEffect(() => {
        let disposed = false;
        const pickMode = new URLSearchParams(window.location.search).get('mode') === 'pick';

        const run = async () => {
            const loaded = await loadTianDiTuScript();
            if (disposed) return;
            const map = loaded ? initTianDiTuMap(MAP_ID, [105, 35], 4) : null;
            if (!map) {
                post({ type: 'failed', message: '地图加载失败，请检查网络后重试' });
                return;
            }
            const T = (window as any).T;

            let pins: MapBridgePin[] = [];
            let overlays: any[] = [];
            let pickedMarker: any = null;
            let userMarker: any = null;
            let pickVersion = 0;
            const dumbbellIcon = createDumbbellIcon();

            const recluster = () => {
                overlays.forEach((overlay) => { try { map.removeOverLay(overlay); } catch (_) {} });
                overlays = [];
                const points = pins.map((pin) => {
                    // 天地图 4.0 是小写 a，个别版本是大写
                    const lngLat = new T.LngLat(pin.longitude, pin.latitude);
                    const point = map.lnglatToLayerPoint ? map.lnglatToLayerPoint(lngLat) : map.lngLatToLayerPoint?.(lngLat);
                    return { x: point?.x ?? 0, y: point?.y ?? 0, latitude: pin.latitude, longitude: pin.longitude, item: pin };
                });
                clusterMapPoints(points, CLUSTER_GRID_PX).forEach((cell) => {
                    const single = cell.items.length === 1;
                    const marker = new T.Marker(new T.LngLat(cell.longitude, cell.latitude));
                    map.addOverLay(marker);
                    const icon = single ? dumbbellIcon : createClusterIcon(cell.items.length);
                    if (icon) { try { marker.setIcon(icon); } catch (_) {} }
                    marker.addEventListener('click', () => {
                        if (single) post({ type: 'pinPress', id: cell.items[0].id });
                        else map.centerAndZoom(new T.LngLat(cell.longitude, cell.latitude), Math.min(18, map.getZoom() + 2));
                    });
                    overlays.push(marker);
                });
            };

            const placePicked = (latitude: number, longitude: number) => {
                if (pickedMarker) { try { map.removeOverLay(pickedMarker); } catch (_) {} }
                pickedMarker = new T.Marker(new T.LngLat(longitude, latitude));
                map.addOverLay(pickedMarker);
                const icon = createRedMarkerIcon();
                if (icon) { try { pickedMarker.setIcon(icon); } catch (_) {} }
            };

            const pick = async (latitude: number, longitude: number) => {
                if (map.getZoom() < MIN_PICK_ZOOM) {
                    post({ type: 'pickTooFar' });
                    return;
                }
                const version = ++pickVersion;
                placePicked(latitude, longitude);
                const empty = { name: '', address: '', country: '', province: '', city: '', county: '' };
                post({ type: 'picked', latitude, longitude, resolving: true, ...empty });
                // 查不到地址也要让用户能确认，不能一直等
                const result = await Promise.race([
                    reverseGeocode(latitude, longitude).catch(() => null),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS)),
                ]);
                if (disposed || version !== pickVersion) return;
                post({ type: 'picked', latitude, longitude, resolving: false, ...parseTianDiTuAddress(result as any) });
            };

            window.__coachlinkMap = {
                receive(command) {
                    if (command.type === 'setPins') {
                        pins = command.pins.map((pin) => toTianDiTuCoordinates(pin) as MapBridgePin);
                        recluster();
                    } else if (command.type === 'moveTo') {
                        map.centerAndZoom(new T.LngLat(command.longitude, command.latitude), command.zoom ?? map.getZoom());
                    } else if (command.type === 'showUser') {
                        if (userMarker) { try { map.removeOverLay(userMarker); } catch (_) {} }
                        userMarker = new T.Marker(new T.LngLat(command.longitude, command.latitude));
                        map.addOverLay(userMarker);
                        try {
                            userMarker.setIcon(new T.Icon({
                                iconUrl: `data:image/svg+xml,${encodeURIComponent(USER_DOT_SVG)}`,
                                iconSize: new T.Point(22, 22),
                                iconAnchor: new T.Point(11, 11),
                            }));
                        } catch (_) {}
                    } else if (command.type === 'setPicked') {
                        ++pickVersion;
                        placePicked(command.latitude, command.longitude);
                    } else if (command.type === 'pickCenter') {
                        const center = map.getCenter();
                        void pick(center.lat, center.lng);
                    } else if (command.type === 'locate') {
                        if (!navigator.geolocation) {
                            post({ type: 'locateFailed' });
                            return;
                        }
                        navigator.geolocation.getCurrentPosition(
                            (position) => post({ type: 'located', latitude: position.coords.latitude, longitude: position.coords.longitude }),
                            () => post({ type: 'locateFailed' }),
                            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
                        );
                    }
                },
            };

            map.addEventListener('zoomend', recluster);
            map.addEventListener('moveend', recluster);
            if (pickMode) {
                T.Event.on(map, 'click', (event: any) => {
                    if (event?.lnglat) void pick(event.lnglat.lat, event.lnglat.lng);
                });
            }
            post({ type: 'ready' });
        };

        run().catch((error) => {
            console.error('[embed/locations-map]', error);
            post({ type: 'failed', message: '地图加载失败，请稍后重试' });
        });
        return () => {
            disposed = true;
            delete window.__coachlinkMap;
        };
    }, []);

    // 盖住根布局的导航栏：这个页面只在 APP 的 WebView 里显示
    return <div id={MAP_ID} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#F4F1EC' }} />;
}
