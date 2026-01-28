"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Calculator, Database, BookOpen } from "lucide-react";

const NAV_ITEMS = [
    { href: "/streetlifting-index", icon: Home, label: "首页" },
    { href: "/streetlifting-index/locations", icon: MapPin, label: "单杠" },
    { href: "/streetlifting-index/calculator", icon: Calculator, label: "计算" },
    { href: "/streetlifting-index/data", icon: Database, label: "社区" },
    { href: "/streetlifting-index/stories", icon: BookOpen, label: "故事" },
];

export function StreetliftingBottomNav({ className }: { className?: string }) {
    const pathname = usePathname();

    return (
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-0 border-t border-surface-100 ${className || ""}`}>
            <div className="flex items-center justify-between px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/streetlifting-index" && pathname?.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center flex-1 gap-1 ${
                                isActive ? "text-primary-600" : "text-surface-500"
                            }`}
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
