import Link from 'next/link';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
    title: string;
    count?: string;
    moreHref?: string;
    moreText?: string;
    children?: ReactNode;
}

export default function SectionHeader({ title, count, moreHref, moreText = '查看更多', children }: SectionHeaderProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <h2 className="text-2xl md:text-[28px] font-black tracking-tight text-surface-900">
                    {title}
                    {count && <span className="ml-2 text-base md:text-lg font-bold text-surface-500">{count}</span>}
                </h2>
                {children}
            </div>
            {moreHref && (
                <Link href={moreHref} className="text-sm md:text-[15px] font-bold text-primary hover:opacity-80">
                    {moreText} ›
                </Link>
            )}
        </div>
    );
}
