"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Calculator, Database, BookOpen } from "lucide-react";
import { STREETLIFTING_NAV_ITEMS } from "@/components/streetlifting-index/StreetliftingNavItems";

const BOTTOM_NAV = STREETLIFTING_NAV_ITEMS.filter((x) =>
    ["home", "locations", "calculator", "data", "stories"].includes(x.key),
).map((x) => {
    const iconMap = {
        home: Home,
        locations: MapPin,
        calculator: Calculator,
        data: Database,
        stories: BookOpen,
    } as const;

    const shortLabelMap: Record<string, string> = {
        home: "首页",
        locations: "单杠",
        calculator: "计算",
        data: "社区",
        stories: "故事",
    };

    return {
        href: x.href,
        Icon: iconMap[x.key as keyof typeof iconMap],
        label: shortLabelMap[x.key] || x.label,
    };
});

export function StreetliftingBottomNav({ className }: { className?: string }) {
    const pathname = usePathname();

    return (
        <nav
            className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-0/90 backdrop-blur border-t border-surface-100 ${className || ""}`}
        >
            <div className="flex items-center justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
                {BOTTOM_NAV.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/streetlifting-index" && pathname?.startsWith(item.href));
                    const Icon = item.Icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center flex-1 gap-1 ${
                                isActive ? "text-primary-600" : "text-surface-500"
                            } transition-transform active:scale-[0.98]`}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.4]" : "stroke-[2]"}`} />
                            <span className={`text-[10px] ${isActive ? "font-semibold" : ""}`}>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
