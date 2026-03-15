'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { loadBodyMap, DecodedBodyMap } from '@/lib/bodyMapDecoder';
import { BodyPart, BODY_PART_METADATA } from './bodyMapTypes';

export type BodyRegion = BodyPart;
export type BodyView = 'front' | 'back';

type BodyMapMode = 'screening' | 'training';

interface BodyMapCanvasProps {
  mode?: BodyMapMode;
  selectedRegion?: BodyRegion | null;
  onRegionClick?: (region: BodyRegion) => void;
  view?: BodyView;
  onViewChange?: (view: BodyView) => void;
  isFocusMode?: boolean;
}

interface LoadState {
  front: 'idle' | 'loading' | 'loaded' | 'error';
  back: 'idle' | 'loading' | 'loaded' | 'error';
}

const JOINTS = ['膝关节', '踝关节', '髋关节', '腕关节', '肩关节'];

function getPartNameFromElement(element: Element): string | null {
  let current: Element | null = element;
  while (current) {
    const name = current.getAttribute('data-name');
    if (name && name !== '肌肉' && name !== '关节' && name !== '全身轮廓') {
      return name;
    }
    current = current.parentElement;
  }
  return null;
}

export default function BodyMapCanvas({
  mode = 'screening',
  selectedRegion,
  onRegionClick,
  view: controlledView,
  onViewChange,
  isFocusMode = false,
}: BodyMapCanvasProps) {
  const [view, setView] = useState<BodyView>(controlledView || 'front');
  const [frontData, setFrontData] = useState<DecodedBodyMap | null>(null);
  const [backData, setBackData] = useState<DecodedBodyMap | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ front: 'idle', back: 'idle' });
  const [hoveredRegion, setHoveredRegion] = useState<BodyRegion | null>(null);
  const [showJoints, setShowJoints] = useState(false);
  const [svgLoaded, setSvgLoaded] = useState(false);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isScreeningMode = mode === 'screening';

  // 声明式高亮：关节隐藏时不应用高亮
  const effectiveSelectedRegion =
    selectedRegion && !(JOINTS.includes(selectedRegion) && !showJoints) ? selectedRegion : '';
  const effectiveHoveredRegion =
    hoveredRegion && !(JOINTS.includes(hoveredRegion) && !showJoints) ? hoveredRegion : '';

  const currentSvg = view === 'front' ? frontData?.svg : backData?.svg;
  const currentMetadata = view === 'front' ? frontData?.metadata : backData?.metadata;
  const isLoading = view === 'front' ? loadState.front === 'loading' : loadState.back === 'loading';
  const hasError = view === 'front' ? loadState.front === 'error' : loadState.back === 'error';

  useEffect(() => {
    if (controlledView) setView(controlledView);
  }, [controlledView]);

  useEffect(() => {
    if (loadState.front === 'idle') {
      setLoadState(prev => ({ ...prev, front: 'loading' }));
      loadBodyMap('/body-map/front.bin')
        .then(data => { setFrontData(data); setLoadState(prev => ({ ...prev, front: 'loaded' })); })
        .catch(() => setLoadState(prev => ({ ...prev, front: 'error' })));
    }
  }, [loadState.front]);

  useEffect(() => {
    if (loadState.back === 'idle') {
      setLoadState(prev => ({ ...prev, back: 'loading' }));
      loadBodyMap('/body-map/back.bin')
        .then(data => { setBackData(data); setLoadState(prev => ({ ...prev, back: 'loaded' })); })
        .catch(() => setLoadState(prev => ({ ...prev, back: 'error' })));
    }
  }, [loadState.back]);

  useEffect(() => {
    if (currentSvg && !isLoading) {
      const timer = setTimeout(() => setSvgLoaded(true), 50);
      return () => clearTimeout(timer);
    } else {
      setSvgLoaded(false);
    }
  }, [currentSvg, isLoading, view]);

  // 控制关节显示/隐藏 - 使用CSS类
  useEffect(() => {
    if (!svgContainerRef.current || !svgLoaded) return;
    
    const container = svgContainerRef.current;
    
    if (showJoints) {
      container.classList.remove('hide-joints');
      container.classList.add('show-joints');
    } else {
      container.classList.add('hide-joints');
      container.classList.remove('show-joints');
    }
  }, [showJoints, svgLoaded, view]);

  const handleSvgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const partName = getPartNameFromElement(target);
    if (partName && BODY_PART_METADATA[partName]) {
      if (JOINTS.includes(partName) && !showJoints) return;
      const newSelection = partName === selectedRegion ? null : partName;
      onRegionClick?.(newSelection as BodyRegion);
    }
  }, [onRegionClick, selectedRegion, showJoints]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const partName = getPartNameFromElement(target);
    
    if (partName && BODY_PART_METADATA[partName]) {
      if (JOINTS.includes(partName) && !showJoints) {
        setHoveredRegion(null);
        (e.currentTarget as HTMLElement).style.cursor = 'default';
        return;
      }
      
      if (partName !== hoveredRegion) setHoveredRegion(partName as BodyRegion);
      (e.currentTarget as HTMLElement).style.cursor = 'pointer';
    } else {
      if (hoveredRegion) setHoveredRegion(null);
      (e.currentTarget as HTMLElement).style.cursor = 'default';
    }
  }, [hoveredRegion, showJoints]);

  const handleMouseLeave = useCallback(() => setHoveredRegion(null), []);

  const handleViewChange = (newView: BodyView) => {
    setView(newView);
    onViewChange?.(newView);
    setHoveredRegion(null);
  };

  return (
    <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
      isFocusMode ? 'lg:transform lg:translate-x-0 lg:scale-90 origin-left' : ''
    }`}>
      {/* 控制按钮 - 放在身体图上方，右对齐 */}
      <div className={`flex items-center justify-end gap-3 mb-4 transition-opacity duration-500 ${
        isFocusMode ? 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto' : ''
      }`}>
        <button
          onClick={() => setShowJoints(!showJoints)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showJoints ? 'bg-surface-900 text-surface-0' : 'bg-surface-100 text-surface-600'
          }`}
        >
          <span className={`relative inline-flex h-4 w-7 items-center rounded-full ${showJoints ? 'bg-surface-0' : 'bg-surface-300'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-surface-900 transition-transform duration-300 ${
              showJoints ? 'translate-x-3.5' : 'translate-x-0.5'
            }`} />
          </span>
          <span>显示关节</span>
        </button>

        <div className="flex gap-1.5 bg-surface-100 p-1 rounded-lg">
          <button
            onClick={() => handleViewChange('front')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'front' ? 'bg-surface-900 text-surface-0' : 'text-surface-600'
            }`}
          >
            前视图
          </button>
          <button
            onClick={() => handleViewChange('back')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'back' ? 'bg-surface-900 text-surface-0' : 'text-surface-600'
            }`}
          >
            后视图
          </button>
        </div>
      </div>

      {/* SVG 容器 - 使用 data 属性实现声明式高亮，避免 focus 过渡时高亮丢失 */}
      <div
        ref={svgContainerRef}
        data-selected-region={effectiveSelectedRegion}
        data-hovered-region={effectiveHoveredRegion}
        className={`body-map-container relative w-full mx-auto select-none transition-all duration-700 ${
          showJoints ? 'show-joints' : 'hide-joints'
        } ${isFocusMode ? 'max-w-[280px]' : 'max-w-[360px]'}`}
        style={{ aspectRatio: '300/600', minHeight: isFocusMode ? '350px' : '450px' }}
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-surface-400 text-sm">
            加载人体地图...
          </div>
        )}
        
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-surface-600 text-sm text-center">
            <p>加载失败</p>
            <button onClick={() => setLoadState(prev => ({ ...prev, [view]: 'idle' }))} className="mt-2 text-xs underline">
              重试
            </button>
          </div>
        )}
        
        {currentSvg && (
          <div 
            key={view}
            className="absolute inset-0 flex items-center justify-center"
            dangerouslySetInnerHTML={{ 
              __html: currentSvg.replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;"')
            }}
          />
        )}
      </div>

      {/* 选中的部位信息 */}
      <div className={`transition-all duration-500 overflow-hidden ${
        selectedRegion ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'
      }`}>
        <div className="p-3 bg-surface-900 rounded-xl text-center">
          <p className="text-sm font-bold text-surface-0">已选择: {selectedRegion}</p>
          {selectedRegion && BODY_PART_METADATA[selectedRegion] && (
            <p className="text-xs text-surface-400 mt-1">
              {BODY_PART_METADATA[selectedRegion].type === 'muscle' ? '肌肉' : '关节'}
            </p>
          )}
        </div>
      </div>

      {/* 部位列表 */}
      {currentMetadata && !isFocusMode && (
        <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-surface-500">
              身体部位 ({currentMetadata.muscles.length + (showJoints ? currentMetadata.joints.length : 0)})
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="font-medium text-surface-400 mb-1">肌肉</p>
                <div className="flex flex-wrap gap-1">
                  {currentMetadata.muscles.map(muscle => (
                    <button
                      key={muscle}
                      onClick={() => onRegionClick?.(muscle as BodyRegion)}
                      className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                        selectedRegion === muscle ? 'bg-surface-900 text-surface-0' : 'bg-surface-100 text-surface-600'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>
              {showJoints && (
                <div>
                  <p className="font-medium text-surface-400 mb-1">关节</p>
                  <div className="flex flex-wrap gap-1">
                    {currentMetadata.joints.map(joint => (
                      <button
                        key={joint}
                        onClick={() => onRegionClick?.(joint as BodyRegion)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                          selectedRegion === joint ? 'bg-surface-900 text-surface-0' : 'bg-surface-100 text-surface-600'
                        }`}
                      >
                        {joint}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* 悬停提示 */}
      {hoveredRegion && hoveredRegion !== selectedRegion && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-surface-900 text-surface-0 text-xs rounded-full shadow-lg pointer-events-none z-50">
          {hoveredRegion}
        </div>
      )}

      {/* 声明式高亮 - 通过 data 属性 + 动态 CSS，不依赖 DOM 查询，避免 focus 过渡时高亮丢失。hover 优先级 > selected */}
      <style
        dangerouslySetInnerHTML={{
          __html: effectiveHoveredRegion
            ? `.body-map-container[data-hovered-region="${effectiveHoveredRegion}"] [data-name="${effectiveHoveredRegion}"] path{fill:#fb923c!important;filter:drop-shadow(0 0 6px rgba(251,146,60,.4))!important}`
            : effectiveSelectedRegion
              ? `.body-map-container[data-selected-region="${effectiveSelectedRegion}"] [data-name="${effectiveSelectedRegion}"] path{fill:#f97316!important;filter:drop-shadow(0 0 8px rgba(249,115,22,.5))!important}`
              : '',
        }}
      />

      {/* CSS 样式 - 关节显示控制 */}
      <style jsx>{`
        /* 隐藏关节 - 使用 !important 确保优先级 */
        .hide-joints :global([data-name="膝关节"]),
        .hide-joints :global([data-name="踝关节"]),
        .hide-joints :global([data-name="髋关节"]),
        .hide-joints :global([data-name="腕关节"]),
        .hide-joints :global([data-name="肩关节"]) {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* 显示关节 */
        .show-joints :global([data-name="膝关节"]),
        .show-joints :global([data-name="踝关节"]),
        .show-joints :global([data-name="髋关节"]),
        .show-joints :global([data-name="腕关节"]),
        .show-joints :global([data-name="肩关节"]) {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        
        /* 确保路径本身也不响应事件 */
        .hide-joints :global([data-name="膝关节"] *),
        .hide-joints :global([data-name="踝关节"] *),
        .hide-joints :global([data-name="髋关节"] *),
        .hide-joints :global([data-name="腕关节"] *),
        .hide-joints :global([data-name="肩关节"] *) {
          pointer-events: none !important;
        }
      `}</style>
    </div>
  );
}

export const BODY_REGION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(BODY_PART_METADATA).map(([k, v]) => [k, v.name])
);
