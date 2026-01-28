"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { StreetliftingHeader } from "@/components/streetlifting-index/StreetliftingHeader";
import { StreetliftingBottomNav } from "@/components/streetlifting-index/StreetliftingBottomNav";
import { StreetliftingSubNav } from "@/components/streetlifting-index/StreetliftingSubNav";
import { AERO_SHELL } from "@/components/streetlifting-index/aero";

export default function StreetliftingIndexShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const showSubNav = useMemo(() => {
        // 首页给内容更强的沉浸感；其他子页提供 SubNav（桌面固定左侧；移动端下拉）
        return pathname !== "/streetlifting-index";
    }, [pathname]);

    return (
        <div className={AERO_SHELL}>
            <div className="sticky top-0 z-50">
                <StreetliftingHeader />
            </div>

            {showSubNav && (
                <div className="pt-4">
                    <div className="max-w-7xl mx-auto px-4">
                        <StreetliftingSubNav />
                    </div>
                </div>
            )}

            <main className="pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-10">{children}</main>

            <StreetliftingBottomNav />
        </div>
    );
}

