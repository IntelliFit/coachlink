"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { TrendingUp } from "lucide-react";

import { STREETLIFTING_NAV_ITEMS, getStreetliftingActiveIndex } from "@/components/streetlifting-index/StreetliftingNavItems";

export function StreetliftingHeader({
    currentPage,
    title,
}: {
    currentPage?: string;
    title?: string;
}) {
    const pathname = usePathname();

    const activeIndex = useMemo(() => getStreetliftingActiveIndex(pathname), [pathname]);
    const activeKey = STREETLIFTING_NAV_ITEMS[activeIndex]?.key;
    const mobileTitle = title || STREETLIFTING_NAV_ITEMS[activeIndex]?.label || "街健力量指数";

    return (
        <header className="bg-surface-0 border-b border-surface-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 md:h-16">
                    <Link href="/streetlifting-index" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div className="hidden sm:block">
                            <div className="text-base font-bold tracking-tight text-surface-900">街健力量指数</div>
                            <div className="text-xs text-surface-500">Streetlifting Index</div>
                        </div>
                    </Link>

                    <nav className="hidden md:flex items-center gap-6 text-sm">
                        {STREETLIFTING_NAV_ITEMS.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`transition-colors ${
                                    (currentPage || activeKey) === item.key
                                        ? "text-surface-900 font-semibold"
                                        : "text-surface-600 hover:text-surface-900"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="md:hidden text-sm font-semibold text-surface-900">
                        {mobileTitle}
                    </div>
                </div>
            </div>
        </header>
    );
}
