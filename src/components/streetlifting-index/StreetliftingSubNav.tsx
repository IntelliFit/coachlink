"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";

type NavItem = {
    key: string;
    label: string;
    href: string;
    icon: string;
};

const NAV: NavItem[] = [
    { key: "home", label: "首页", href: "/streetlifting-index", icon: "pi pi-home" },
    { key: "calculator", label: "计算器", href: "/streetlifting-index/calculator", icon: "pi pi-calculator" },
    { key: "data", label: "数据社区", href: "/streetlifting-index/data", icon: "pi pi-database" },
    { key: "locations", label: "找单杠", href: "/streetlifting-index/locations", icon: "pi pi-map-marker" },
    { key: "stories", label: "故事", href: "/streetlifting-index/stories", icon: "pi pi-book" },
    { key: "methodology", label: "方法论", href: "/streetlifting-index/methodology", icon: "pi pi-info-circle" },
];

function getActiveIndex(pathname: string | null) {
    const path = pathname || "";
    const idx = NAV.findIndex((x) => x.href === path || (x.href !== "/streetlifting-index" && path.startsWith(x.href)));
    return idx >= 0 ? idx : 0;
}

export function StreetliftingSubNav({ className }: { className?: string }) {
    const pathname = usePathname();
    const router = useRouter();

    const activeIndex = useMemo(() => getActiveIndex(pathname), [pathname]);

    const mobileOptions = useMemo(
        () => NAV.map((x) => ({ label: x.label, value: x.href })),
        [],
    );

    const mobileValue = NAV[activeIndex]?.href || "/streetlifting-index";

    return (
        <>
            {/* Desktop：左侧纵向悬浮菜单（不占页面流式布局高度） */}
            <div className="hidden md:block">
                <div className="fixed left-4 top-24 z-40">
                    <Card className="rounded-3xl border border-surface-200 bg-surface/85 backdrop-blur-md shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
                        <div className="p-2 w-48 space-y-1">
                            {NAV.map((item, idx) => {
                                const active = idx === activeIndex;
                                return (
                                    <Button
                                        key={item.key}
                                        type="button"
                                        icon={item.icon}
                                        label={item.label}
                                        onClick={() => router.push(item.href)}
                                        className={[
                                            "w-full justify-start rounded-2xl",
                                            active
                                                ? "bg-primary-50 text-primary-700 border border-primary-100"
                                                : "p-button-text text-surface-700 hover:bg-surface-100",
                                        ].join(" ")}
                                        severity={active ? "help" : undefined}
                                        text={!active}
                                    />
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Mobile：仍用下拉（避免与全站移动端顶部/底部导航拥挤冲突） */}
            <div className={`md:hidden ${className || ""}`}>
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
        </>
    );
}

