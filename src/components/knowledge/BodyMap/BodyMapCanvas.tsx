'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// Body regions for click handling
export type BodyRegion =
  | 'head'
  | 'neck'
  | 'shoulder_left'
  | 'shoulder_right'
  | 'chest'
  | 'upper_back'
  | 'lower_back'
  | 'core'
  | 'hip_left'
  | 'hip_right'
  | 'elbow_left'
  | 'elbow_right'
  | 'wrist_left'
  | 'wrist_right'
  | 'knee_left'
  | 'knee_right'
  | 'ankle_left'
  | 'ankle_right';

type BodyMapMode = 'screening' | 'training';
type BodyView = 'front' | 'back';

export interface BodyMapSelectionDetail {
  anatomyKey: string;
  anatomyLabel: string;
  view: BodyView;
}

interface BodyMapCanvasProps {
  mode?: BodyMapMode;
  selectedRegion?: BodyRegion | null;
  onRegionClick?: (region: BodyRegion, detail?: BodyMapSelectionDetail) => void;
}

interface HitInfo {
  region: BodyRegion;
  anatomyKey: string;
  anatomyLabel: string;
}

const BODY_REGION_LABELS_MAP: Record<BodyRegion, string> = {
  head: '头部',
  neck: '颈部',
  shoulder_left: '左肩',
  shoulder_right: '右肩',
  chest: '胸部',
  upper_back: '上背',
  lower_back: '下背',
  core: '核心',
  hip_left: '左髋',
  hip_right: '右髋',
  elbow_left: '左肘',
  elbow_right: '右肘',
  wrist_left: '左腕',
  wrist_right: '右腕',
  knee_left: '左膝',
  knee_right: '右膝',
  ankle_left: '左踝',
  ankle_right: '右踝',
};

const BILATERAL_GROUPS: Record<string, [BodyRegion, BodyRegion]> = {
  三角肌: ['shoulder_left', 'shoulder_right'],
  肩关节: ['shoulder_left', 'shoulder_right'],
  肱二头肌: ['elbow_left', 'elbow_right'],
  肱三头肌: ['elbow_left', 'elbow_right'],
  肱桡肌: ['elbow_left', 'elbow_right'],
  肱侧腕屈肌: ['wrist_left', 'wrist_right'],
  腕关节: ['wrist_left', 'wrist_right'],
  髋关节: ['hip_left', 'hip_right'],
  内收肌: ['hip_left', 'hip_right'],
  臀大肌: ['hip_left', 'hip_right'],
  股四头肌: ['knee_left', 'knee_right'],
  股二头肌: ['knee_left', 'knee_right'],
  半腱肌: ['knee_left', 'knee_right'],
  膝关节: ['knee_left', 'knee_right'],
  胫骨前肌: ['ankle_left', 'ankle_right'],
  腓肠肌: ['ankle_left', 'ankle_right'],
  比目鱼肌: ['ankle_left', 'ankle_right'],
  踝关节: ['ankle_left', 'ankle_right'],
};

const SINGLE_GROUPS: Record<string, BodyRegion> = {
  斜方肌: 'neck',
  胸大肌: 'chest',
  腹直肌: 'core',
  腹外直肌: 'core',
  背阔肌: 'upper_back',
  岗下肌: 'upper_back',
  大圆肌: 'upper_back',
  竖脊肌: 'lower_back',
};

function getInteractiveGroupNames(): Set<string> {
  return new Set([...Object.keys(BILATERAL_GROUPS), ...Object.keys(SINGLE_GROUPS)]);
}

function regionColor(mode: BodyMapMode, state: 'selected' | 'hover') {
  const isScreening = mode === 'screening';
  if (state === 'selected') return isScreening ? '#ef4444' : '#3b82f6';
  return isScreening ? '#fca5a5' : '#93c5fd';
}

function resolveRenderedSide(pathEl: SVGPathElement): 'left' | 'right' {
  const svg = pathEl.ownerSVGElement;
  if (!svg) return 'left';

  const pathRect = pathEl.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();
  const pathCenterX = pathRect.left + pathRect.width / 2;
  const svgCenterX = svgRect.left + svgRect.width / 2;
  return pathCenterX < svgCenterX ? 'left' : 'right';
}

export default function BodyMapCanvas({ mode = 'screening', selectedRegion, onRegionClick }: BodyMapCanvasProps) {
  const [hoveredHit, setHoveredHit] = useState<HitInfo | null>(null);
  const [selectedHit, setSelectedHit] = useState<HitInfo | null>(null);
  const [view, setView] = useState<BodyView>('front');
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [loadingSvg, setLoadingSvg] = useState<boolean>(true);
  const [svgError, setSvgError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const interactiveGroupNames = useMemo(() => getInteractiveGroupNames(), []);

  const isScreeningMode = mode === 'screening';

  useEffect(() => {
    setHoveredHit(null);
    setSelectedHit(null);
  }, [view]);

  useEffect(() => {
    if (!selectedRegion) {
      setSelectedHit(null);
    }
  }, [selectedRegion]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSvg(true);
    setSvgError(null);

    fetch(`/api/knowledge/body-map-svg?view=${view}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('加载人体地图素材失败');
        return res.text();
      })
      .then((raw) => {
        if (cancelled) return;
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg) throw new Error('SVG 结构无效');

        svg.setAttribute('class', 'w-full h-auto');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        interactiveGroupNames.forEach((name) => {
          const escaped = window.CSS?.escape ? window.CSS.escape(name) : name;
          const selector = `g[data-name="${escaped}"] path`;
          const paths = Array.from(svg.querySelectorAll<SVGPathElement>(selector));
          for (const path of paths) {
            path.setAttribute('data-group', name);
            path.setAttribute('data-original-fill', path.getAttribute('fill') || '#222222');
            path.style.cursor = 'pointer';
            path.style.transition = 'fill 120ms ease, stroke 120ms ease';
          }
        });

        setSvgMarkup(svg.outerHTML);
      })
      .catch((err) => {
        console.error('[BodyMapCanvas] load svg failed:', err);
        if (!cancelled) {
          setSvgMarkup('');
          setSvgError('人体地图加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSvg(false);
      });

    return () => {
      cancelled = true;
    };
  }, [interactiveGroupNames, view]);

  function resolveHit(groupName: string, pathEl: SVGPathElement): HitInfo | null {
    const single = SINGLE_GROUPS[groupName];
    if (single) {
      return {
        region: single,
        anatomyKey: groupName,
        anatomyLabel: groupName,
      };
    }

    const bilateral = BILATERAL_GROUPS[groupName];
    if (!bilateral) return null;

    try {
      const side = resolveRenderedSide(pathEl);
      const isLeft = side === 'left';
      return {
        region: isLeft ? bilateral[0] : bilateral[1],
        anatomyKey: `${groupName}:${isLeft ? 'left' : 'right'}`,
        anatomyLabel: `${isLeft ? '左' : '右'}${groupName}`,
      };
    } catch {
      return {
        region: bilateral[0],
        anatomyKey: `${groupName}:left`,
        anatomyLabel: `左${groupName}`,
      };
    }
  }

  function findHitFromEventTarget(target: EventTarget | null): HitInfo | null {
    if (!(target instanceof Element)) return null;
    const path = target.closest('path[data-group]') as SVGPathElement | null;
    if (!path) return null;
    const group = path.getAttribute('data-group');
    if (!group) return null;
    return resolveHit(group, path);
  }

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const allPaths = Array.from(root.querySelectorAll<SVGPathElement>('path[data-group]'));
    for (const path of allPaths) {
      const group = path.getAttribute('data-group');
      if (!group) continue;
      const hit = resolveHit(group, path);
      if (!hit) continue;
      const originalFill = path.getAttribute('data-original-fill') || '#222222';
      const isSelected = selectedHit?.anatomyKey === hit.anatomyKey;
      const isHovered = hoveredHit?.anatomyKey === hit.anatomyKey;

      if (isSelected) {
        path.style.fill = regionColor(mode, 'selected');
        path.style.stroke = mode === 'screening' ? '#dc2626' : '#2563eb';
        path.style.strokeWidth = '1.8';
      } else if (isHovered) {
        path.style.fill = regionColor(mode, 'hover');
        path.style.stroke = mode === 'screening' ? '#f43f5e' : '#3b82f6';
        path.style.strokeWidth = '1.4';
      } else {
        path.style.fill = originalFill;
        path.style.stroke = 'transparent';
        path.style.strokeWidth = '0';
      }
    }
  }, [hoveredHit, mode, selectedHit, svgMarkup]);

  const selectedLabel = selectedHit
    ? selectedHit.anatomyLabel
    : (selectedRegion ? BODY_REGION_LABELS_MAP[selectedRegion] : null);
  const selectedRegionLabel = selectedHit
    ? BODY_REGION_LABELS_MAP[selectedHit.region]
    : (selectedRegion ? BODY_REGION_LABELS_MAP[selectedRegion] : null);

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 flex gap-2 z-10">
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold ${
            isScreeningMode
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
              : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
          }`}
        >
          {isScreeningMode ? '🩺 筛查模式' : '💪 训练模式'}
        </span>
      </div>

      <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-lg bg-white/80 dark:bg-surface-800/80 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => setView('front')}
          className={`px-2 py-1 text-xs font-semibold rounded ${
            view === 'front'
              ? 'bg-primary-500 text-white'
              : 'text-surface-600 dark:text-surface-300'
          }`}
        >
          正面
        </button>
        <button
          type="button"
          onClick={() => setView('back')}
          className={`px-2 py-1 text-xs font-semibold rounded ${
            view === 'back'
              ? 'bg-primary-500 text-white'
              : 'text-surface-600 dark:text-surface-300'
          }`}
        >
          背面
        </button>
      </div>

      <div className="mx-auto w-full max-w-sm pt-8">
        {loadingSvg && (
          <div className="h-[520px] rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
        )}

        {!loadingSvg && svgError && (
          <div className="h-[520px] rounded-xl border border-dashed border-surface-300 dark:border-surface-600 text-xs text-surface-500 flex items-center justify-center">
            {svgError}
          </div>
        )}

        {!loadingSvg && !svgError && svgMarkup && (
          <div className="relative">
            <div
              ref={containerRef}
              className="relative select-none"
              onClick={(e) => {
                const hit = findHitFromEventTarget(e.target);
                if (!hit) return;
                setSelectedHit(hit);
                onRegionClick?.(hit.region, {
                  anatomyKey: hit.anatomyKey,
                  anatomyLabel: hit.anatomyLabel,
                  view,
                });
              }}
              onMouseMove={(e) => {
                const hit = findHitFromEventTarget(e.target);
                setHoveredHit(hit);
              }}
              onMouseLeave={() => setHoveredHit(null)}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
            <button
              type="button"
              className={`absolute left-1/2 top-6 -translate-x-1/2 h-11 w-11 rounded-full border transition ${
                selectedHit?.anatomyKey === 'head'
                  ? 'border-primary-500 bg-primary-100/80 dark:bg-primary-900/40'
                  : 'border-surface-300 bg-white/50 hover:bg-white/80 dark:border-surface-600 dark:bg-surface-700/50'
              }`}
              title="头部"
              onClick={() => {
                const headHit: HitInfo = { region: 'head', anatomyKey: 'head', anatomyLabel: '头部' };
                setSelectedHit(headHit);
                onRegionClick?.('head', {
                  anatomyKey: 'head',
                  anatomyLabel: '头部',
                  view,
                });
              }}
              onMouseEnter={() => setHoveredHit({ region: 'head', anatomyKey: 'head', anatomyLabel: '头部' })}
              onMouseLeave={() => setHoveredHit(null)}
            />
          </div>
        )}
      </div>

      {selectedRegion && (
        <div className="mt-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-xl text-center">
          <p className="text-sm font-bold text-surface-700 dark:text-surface-200">
            已选择: {selectedLabel}
          </p>
          {selectedRegionLabel && (
            <p className="text-xs text-surface-500 mt-1">
              归属部位: {selectedRegionLabel}
            </p>
          )}
          <p className="text-xs text-surface-500 mt-1">
            {isScreeningMode ? '点击查看相关筛查与缓解方案' : '点击查看相关训练动作'}
          </p>
        </div>
      )}
    </div>
  );
}

// Export body region labels for use elsewhere
export const BODY_REGION_LABELS = BODY_REGION_LABELS_MAP;
