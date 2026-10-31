import type { Viewport } from 'next';
import type { ReactNode } from 'react';

// 双指缩放要交给地图，不能让页面自己放大
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function EmbedLayout({ children }: { children: ReactNode }) {
    return children;
}
