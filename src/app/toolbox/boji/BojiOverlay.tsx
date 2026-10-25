'use client';

import { useMemo } from 'react';
import {
  BOJI_SHAPE_COLORS,
  bojiEnclosureColor,
  bojiOverlayShapes,
  type BojiReport,
} from '@coachlink/core/src/bojiDetector';

interface BojiOverlayProps {
  photoUrl: string;
  width: number;
  height: number;
  report: BojiReport;
  showMarks: boolean;
}

/** 照片 + 测量标注。坐标已由报告的 to_original 换算到这张照片上。 */
export default function BojiOverlay({ photoUrl, width, height, report, showMarks }: BojiOverlayProps) {
  const shapes = useMemo(() => bojiOverlayShapes(report), [report]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-[#2E2A26]">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not a remote asset */}
      <img src={photoUrl} alt="你上传的照片" className="block h-auto w-full" />
      {showMarks && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {shapes.map((shape, index) => {
            const points = shape.points.map(([x, y]) => `${x},${y}`).join(' ');
            if (shape.kind === 'block') {
              const color = bojiEnclosureColor(shape.enclosure ?? 0);
              return (
                <polygon
                  key={index}
                  points={points}
                  fill={color}
                  fillOpacity={0.3}
                  stroke={color}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            }
            const thick = shape.kind === 'shoulder' || shape.kind === 'waist';
            return (
              <polyline
                key={index}
                points={points}
                fill="none"
                stroke={BOJI_SHAPE_COLORS[shape.kind]}
                strokeWidth={thick ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={shape.kind === 'lateral' ? '6 5' : undefined}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
