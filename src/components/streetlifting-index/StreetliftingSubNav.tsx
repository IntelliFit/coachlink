"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { STREETLIFTING_NAV_ITEMS, getStreetliftingActiveIndex } from "@/components/streetlifting-index/StreetliftingNavItems";

export function StreetliftingSubNav({ className }: { className?: string }) {
    const pathname = usePathname();
    const router = useRouter();

    const activeIndex = useMemo(() => getStreetliftingActiveIndex(pathname), [pathname]);

    const mobileOptions = useMemo(
        () => STREETLIFTING_NAV_ITEMS.map((x) => ({ label: x.label, value: x.href })),
        [],
    );

    const mobileValue = STREETLIFTING_NAV_ITEMS[activeIndex]?.href || "/streetlifting-index";

    return (
        <div className={className || ""}>
            <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                <div className="p-3">
                    <Dropdown
                        value={mobileValue}
                        options={mobileOptions}
                        className="w-full"
                        onChange={(e) => router.push(e.value)}
                    />
                </div>
            </Card>
        </div>
    );
}

