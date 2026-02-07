'use client';

import React, { useState } from 'react';

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

interface BodyMapCanvasProps {
  mode?: BodyMapMode;
  selectedRegion?: BodyRegion | null;
  onRegionClick?: (region: BodyRegion) => void;
}

// SVG path data for body regions (simplified human silhouette)
const BODY_PATHS: Record<BodyRegion, { d: string; label: string; center: [number, number] }> = {
  head: {
    d: 'M45,8 C45,3 55,3 55,8 L55,18 C55,23 45,23 45,18 Z',
    label: '头部',
    center: [50, 13],
  },
  neck: {
    d: 'M47,18 L53,18 L53,25 L47,25 Z',
    label: '颈部',
    center: [50, 21],
  },
  shoulder_left: {
    d: 'M30,25 L47,25 L47,35 L35,38 L30,35 Z',
    label: '左肩',
    center: [38, 31],
  },
  shoulder_right: {
    d: 'M53,25 L70,25 L70,35 L65,38 L53,35 Z',
    label: '右肩',
    center: [62, 31],
  },
  chest: {
    d: 'M40,35 L60,35 L60,55 L40,55 Z',
    label: '胸部',
    center: [50, 45],
  },
  upper_back: {
    d: 'M42,36 L58,36 L58,50 L42,50 Z',
    label: '上背',
    center: [50, 43],
  },
  core: {
    d: 'M42,55 L58,55 L58,72 L42,72 Z',
    label: '核心',
    center: [50, 63],
  },
  lower_back: {
    d: 'M44,55 L56,55 L56,70 L44,70 Z',
    label: '下背',
    center: [50, 62],
  },
  hip_left: {
    d: 'M35,72 L48,72 L46,82 L33,82 Z',
    label: '左髋',
    center: [41, 77],
  },
  hip_right: {
    d: 'M52,72 L65,72 L67,82 L54,82 Z',
    label: '右髋',
    center: [59, 77],
  },
  elbow_left: {
    d: 'M22,38 L30,35 L28,55 L20,55 Z',
    label: '左肘',
    center: [25, 45],
  },
  elbow_right: {
    d: 'M70,35 L78,38 L80,55 L72,55 Z',
    label: '右肘',
    center: [75, 45],
  },
  wrist_left: {
    d: 'M18,55 L26,55 L24,70 L16,70 Z',
    label: '左腕',
    center: [21, 62],
  },
  wrist_right: {
    d: 'M74,55 L82,55 L84,70 L76,70 Z',
    label: '右腕',
    center: [79, 62],
  },
  knee_left: {
    d: 'M36,95 L46,95 L46,108 L36,108 Z',
    label: '左膝',
    center: [41, 101],
  },
  knee_right: {
    d: 'M54,95 L64,95 L64,108 L54,108 Z',
    label: '右膝',
    center: [59, 101],
  },
  ankle_left: {
    d: 'M38,125 L46,125 L46,135 L38,135 Z',
    label: '左踝',
    center: [42, 130],
  },
  ankle_right: {
    d: 'M54,125 L62,125 L62,135 L54,135 Z',
    label: '右踝',
    center: [58, 130],
  },
};

// Limb connections (for displaying body outline)
const BODY_OUTLINE = `
  M50,18 
  C45,25 35,25 30,30 
  L20,55 L16,70 
  M30,30 L35,38 L35,72 L33,82 L36,95 L36,108 L38,125 L38,135
  M50,18 
  C55,25 65,25 70,30 
  L80,55 L84,70
  M70,30 L65,38 L65,72 L67,82 L64,95 L64,108 L62,125 L62,135
  M35,38 L40,35 L60,35 L65,38
  M35,72 L42,72 L58,72 L65,72
`;

export default function BodyMapCanvas({ mode = 'screening', selectedRegion, onRegionClick }: BodyMapCanvasProps) {
  const [hoveredRegion, setHoveredRegion] = useState<BodyRegion | null>(null);

  const isScreeningMode = mode === 'screening';

  // Get fill color based on state
  const getFillColor = (region: BodyRegion) => {
    if (selectedRegion === region) {
      return isScreeningMode ? '#ef4444' : '#3b82f6'; // red for pain, blue for training
    }
    if (hoveredRegion === region) {
      return isScreeningMode ? '#fca5a5' : '#93c5fd';
    }
    return '#e2e8f0'; // default gray
  };

  return (
    <div className="relative">
      {/* Mode indicator */}
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

      <svg viewBox="0 0 100 140" className="w-full max-w-xs mx-auto" style={{ maxHeight: '400px' }}>
        {/* Body outline */}
        <path
          d={BODY_OUTLINE}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Clickable body regions */}
        {Object.entries(BODY_PATHS).map(([key, { d, label }]) => {
          const region = key as BodyRegion;
          return (
            <g key={region}>
              <path
                d={d}
                fill={getFillColor(region)}
                stroke={selectedRegion === region ? (isScreeningMode ? '#dc2626' : '#2563eb') : '#64748b'}
                strokeWidth={selectedRegion === region ? '1' : '0.5'}
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredRegion(region)}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={() => onRegionClick?.(region)}
              />
              {/* Show label on hover */}
              {hoveredRegion === region && (
                <text
                  x={BODY_PATHS[region].center[0]}
                  y={BODY_PATHS[region].center[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[4px] font-bold fill-surface-800 pointer-events-none"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Selected region info */}
      {selectedRegion && (
        <div className="mt-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-xl text-center">
          <p className="text-sm font-bold text-surface-700 dark:text-surface-200">
            已选择: {BODY_PATHS[selectedRegion].label}
          </p>
          <p className="text-xs text-surface-500 mt-1">
            {isScreeningMode ? '点击查看相关筛查与缓解方案' : '点击查看相关训练动作'}
          </p>
        </div>
      )}
    </div>
  );
}

// Export body region labels for use elsewhere
export const BODY_REGION_LABELS = Object.fromEntries(
  Object.entries(BODY_PATHS).map(([k, v]) => [k, v.label])
) as Record<BodyRegion, string>;
