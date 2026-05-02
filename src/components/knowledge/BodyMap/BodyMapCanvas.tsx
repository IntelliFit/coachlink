'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BodyPart, BODY_PART_METADATA, BODY_PART_CATEGORY_MAP, CATEGORY_TO_BODY_PARTS } from './bodyMapTypes';

export type BodyRegion = BodyPart;
export type BodyView = 'front' | 'back';
type BodyMapMode = 'screening' | 'training';
export type DisplayMode = 'normal' | 'professional';

interface BodyMapCanvasProps {
  mode?: BodyMapMode;
  selectedRegion?: BodyRegion | null;
  onRegionClick?: (region: BodyRegion) => void;
  view?: BodyView;
  onViewChange?: (view: BodyView) => void;
  isFocusMode?: boolean;
  gender?: 'male' | 'female' | 'unknown';
  displayMode?: DisplayMode;
  onDisplayModeChange?: (mode: DisplayMode) => void;
}

interface LoadState {
  front: 'idle' | 'loading' | 'loaded' | 'error';
  back: 'idle' | 'loading' | 'loaded' | 'error';
}

interface SvgMetadata {
  dataNames: string[];
  categories: string[];
  dataNameToCategory: Record<string, string>;
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

/** 从 SVG 字符串中提取所有 data-name 和 category */
function parseSvgMetadata(svg: string): SvgMetadata {
  const dataNameToCategory: Record<string, string> = {};
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const groups = doc.querySelectorAll('g[data-name]');
  
  groups.forEach((g) => {
    const dataName = g.getAttribute('data-name');
    const category = g.getAttribute('category');
    if (dataName && category && dataName !== '肌肉' && dataName !== '关节' && dataName !== '全身轮廓') {
      dataNameToCategory[dataName] = category;
    }
  });

  // 也检查现有的 BODY_PART_CATEGORY_MAP 作为补充
  Object.entries(BODY_PART_CATEGORY_MAP).forEach(([name, category]) => {
    if (!dataNameToCategory[name]) {
      dataNameToCategory[name] = category;
    }
  });

  const dataNames = Object.keys(dataNameToCategory);
  const categories = Array.from(new Set(Object.values(dataNameToCategory)));

  return { dataNames, categories, dataNameToCategory };
}

export default function BodyMapCanvas({
  mode = 'screening',
  selectedRegion,
  onRegionClick,
  view: controlledView,
  onViewChange,
  isFocusMode = false,
  gender = 'male',
  displayMode = 'normal',
  onDisplayModeChange,
}: BodyMapCanvasProps) {
  const [view, setView] = useState<BodyView>(controlledView || 'front');
  const [frontSvg, setFrontSvg] = useState<string | null>(null);
  const [backSvg, setBackSvg] = useState<string | null>(null);
  const [frontMeta, setFrontMeta] = useState<SvgMetadata | null>(null);
  const [backMeta, setBackMeta] = useState<SvgMetadata | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ front: 'idle', back: 'idle' });
  const [hoveredRegion, setHoveredRegion] = useState<BodyRegion | null>(null);
  const [showJoints, setShowJoints] = useState(false);
  const [svgLoaded, setSvgLoaded] = useState(false);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isScreeningMode = mode === 'screening';

  const effectiveGender = gender === 'female' ? 'female' : 'male';

  // 声明式高亮：关节隐藏时不应用高亮
  const effectiveSelectedRegion =
    selectedRegion && !(JOINTS.includes(selectedRegion) && !showJoints) ? selectedRegion : '';
  const effectiveHoveredRegion =
    hoveredRegion && !(JOINTS.includes(hoveredRegion) && !showJoints) ? hoveredRegion : '';

  const currentSvg = view === 'front' ? frontSvg : backSvg;
  const currentMeta = view === 'front' ? frontMeta : backMeta;
  const isLoading = view === 'front' ? loadState.front === 'loading' : loadState.back === 'loading';
  const hasError = view === 'front' ? loadState.front === 'error' : loadState.back === 'error';

  useEffect(() => {
    if (controlledView) setView(controlledView);
  }, [controlledView]);

  // 加载 SVG
  useEffect(() => {
    if (loadState.front === 'idle') {
      setLoadState(prev => ({ ...prev, front: 'loading' }));
      fetch(`/body-map/${effectiveGender}-front.svg`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load front SVG: ${res.status}`);
          return res.text();
        })
        .then(svg => {
          setFrontSvg(svg);
          setFrontMeta(parseSvgMetadata(svg));
          setLoadState(prev => ({ ...prev, front: 'loaded' }));
        })
        .catch(() => setLoadState(prev => ({ ...prev, front: 'error' })));
    }
  }, [loadState.front, effectiveGender]);

  useEffect(() => {
    if (loadState.back === 'idle') {
      setLoadState(prev => ({ ...prev, back: 'loading' }));
      fetch(`/body-map/${effectiveGender}-back.svg`)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load back SVG: ${res.status}`);
          return res.text();
        })
        .then(svg => {
          setBackSvg(svg);
          setBackMeta(parseSvgMetadata(svg));
          setLoadState(prev => ({ ...prev, back: 'loaded' }));
        })
        .catch(() => setLoadState(prev => ({ ...prev, back: 'error' })));
    }
  }, [loadState.back, effectiveGender]);

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

  const resolveClickTarget = useCallback((dataName: string | null): string | null => {
    if (!dataName || !currentMeta) return null;
    if (displayMode === 'professional') {
      return dataName;
    }
    // normal mode: return category
    return currentMeta.dataNameToCategory[dataName] || dataName;
  }, [currentMeta, displayMode]);

  const handleSvgClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const partName = getPartNameFromElement(target);
    if (partName && currentMeta?.dataNameToCategory[partName]) {
      if (JOINTS.includes(partName) && !showJoints) return;
      const clickTarget = resolveClickTarget(partName);
      if (!clickTarget) return;
      const newSelection = clickTarget === selectedRegion ? null : clickTarget;
      onRegionClick?.(newSelection as BodyRegion);
    }
  }, [onRegionClick, selectedRegion, showJoints, currentMeta, resolveClickTarget]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const partName = getPartNameFromElement(target);
    
    if (partName && currentMeta?.dataNameToCategory[partName]) {
      if (JOINTS.includes(partName) && !showJoints) {
        setHoveredRegion(null);
        (e.currentTarget as HTMLElement).style.cursor = 'default';
        return;
      }
      
      const hoverTarget = resolveClickTarget(partName);
      if (hoverTarget && hoverTarget !== hoveredRegion) {
        setHoveredRegion(hoverTarget as BodyRegion);
      }
      (e.currentTarget as HTMLElement).style.cursor = 'pointer';
    } else {
      if (hoveredRegion) setHoveredRegion(null);
      (e.currentTarget as HTMLElement).style.cursor = 'default';
    }
  }, [hoveredRegion, showJoints, currentMeta, resolveClickTarget]);

  const handleMouseLeave = useCallback(() => setHoveredRegion(null), []);

  const handleViewChange = (newView: BodyView) => {
    setView(newView);
    onViewChange?.(newView);
    setHoveredRegion(null);
  };

  // 生成高亮 CSS 选择器
  const generateHighlightCss = (): string => {
    if (!currentMeta) return '';
    
    const target = effectiveHoveredRegion || effectiveSelectedRegion;
    if (!target) return '';

    if (displayMode === 'professional') {
      // 专业模式：只高亮对应的 data-name
      return `.body-map-container [data-name="${target}"] path{fill:#fb923c!important;filter:drop-shadow(0 0 6px rgba(251,146,60,.4))!important}`;
    }

    // 普通模式：高亮该 category 下的所有 data-name
    const dataNamesInCategory = Object.entries(currentMeta.dataNameToCategory)
      .filter(([, cat]) => cat === target)
      .map(([name]) => name);
    
    if (dataNamesInCategory.length === 0) return '';

    const isHover = !!effectiveHoveredRegion;
    const color = isHover ? '#fb923c' : '#f97316';
    const shadow = isHover ? '6px rgba(251,146,60,.4)' : '8px rgba(249,115,22,.5)';
    
    const selectors = dataNamesInCategory.map(name => `.body-map-container [data-name="${name}"] path`).join(',');
    return `${selectors}{fill:${color}!important;filter:drop-shadow(0 0 ${shadow})!important}`;
  };

  // 获取当前视图下可用的品类列表（普通模式用）
  const availableCategories = currentMeta?.categories || [];
  const availableDataNames = currentMeta?.dataNames || [];

  return (
    <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
      isFocusMode ? 'lg:transform lg:translate-x-0 lg:scale-90 origin-left' : ''
    }`}>
      {/* 控制按钮 - 放在身体图上方，右对齐 */}
      <div className={`flex items-center justify-end gap-3 mb-4 transition-opacity duration-500 ${
        isFocusMode ? 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto' : ''
      }`}>
        {/* 专业/普通模式切换 */}
        <div className="flex gap-1.5 bg-surface-100 p-1 rounded-lg">
          <button
            onClick={() => onDisplayModeChange?.('normal')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              displayMode === 'normal' ? 'bg-surface-900 text-surface-0' : 'text-surface-600'
            }`}
          >
            普通模式
          </button>
          <button
            onClick={() => onDisplayModeChange?.('professional')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              displayMode === 'professional' ? 'bg-surface-900 text-surface-0' : 'text-surface-600'
            }`}
          >
            专业模式
          </button>
        </div>

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

      {/* SVG 容器 */}
      <div
        ref={svgContainerRef}
        className={`body-map-container relative w-full mx-auto select-none transition-all duration-700 ${
          showJoints ? 'show-joints' : 'hide-joints'
        } ${isFocusMode ? 'max-w-[400px]' : 'max-w-[520px]'}`}
        style={{ aspectRatio: '300/600', minHeight: isFocusMode ? '500px' : '650px' }}
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
            key={`${view}-${effectiveGender}`}
            className="absolute inset-0 flex items-center justify-center"
            dangerouslySetInnerHTML={{ 
              __html: currentSvg
                .replace(/<svg/i, '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;"')
                .replace(/fill:#fff/gi, 'fill:#222222')
                .replace(/fill="#fff"/gi, 'fill="#222222"')
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
          {selectedRegion && displayMode === 'professional' && BODY_PART_METADATA[selectedRegion] && (
            <p className="text-xs text-surface-400 mt-1">
              {BODY_PART_METADATA[selectedRegion]?.type === 'muscle' ? '肌肉' : '关节'}
            </p>
          )}
          {selectedRegion && displayMode === 'normal' && (
            <p className="text-xs text-surface-400 mt-1">
              {CATEGORY_TO_BODY_PARTS[selectedRegion]?.length || 0} 个细分部位
            </p>
          )}
        </div>
      </div>

      {/* 部位列表 */}
      {currentMeta && !isFocusMode && (
        <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-surface-500">
              {displayMode === 'professional' 
                ? `身体部位 (${availableDataNames.length + (showJoints ? 0 : 0)})`
                : `身体品类 (${availableCategories.length})`
              }
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {displayMode === 'professional' ? (
                <div className="col-span-2">
                  <p className="font-medium text-surface-400 mb-1">肌肉与关节</p>
                  <div className="flex flex-wrap gap-1">
                    {availableDataNames.map(name => (
                      <button
                        key={name}
                        onClick={() => onRegionClick?.(name as BodyRegion)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                          selectedRegion === name ? 'bg-surface-900 text-surface-0' : 'bg-surface-100 text-surface-600'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="col-span-2">
                  <p className="font-medium text-surface-400 mb-1">品类</p>
                  <div className="flex flex-wrap gap-1">
                    {availableCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => onRegionClick?.(cat as BodyRegion)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                          selectedRegion === cat ? 'bg-surface-900 text-surface-0' : 'bg-surface-100 text-surface-600'
                        }`}
                      >
                        {cat}
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

      {/* 声明式高亮 */}
      <style
        dangerouslySetInnerHTML={{
          __html: generateHighlightCss(),
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
