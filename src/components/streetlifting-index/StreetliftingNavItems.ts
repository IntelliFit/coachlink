export type StreetliftingNavItem = {
    key: string;
    label: string;
    href: string;
    icon: string; // PrimeIcons class, e.g. "pi pi-home"
};

export const STREETLIFTING_NAV_ITEMS: StreetliftingNavItem[] = [
    { key: "home", label: "首页", href: "/streetlifting-index", icon: "pi pi-home" },
    { key: "calculator", label: "计算器", href: "/streetlifting-index/calculator", icon: "pi pi-calculator" },
    { key: "data", label: "数据社区", href: "/streetlifting-index/data", icon: "pi pi-database" },
    { key: "locations", label: "找单杠", href: "/streetlifting-index/locations", icon: "pi pi-map-marker" },
    { key: "stories", label: "故事", href: "/streetlifting-index/stories", icon: "pi pi-book" },
    { key: "methodology", label: "方法论", href: "/streetlifting-index/methodology", icon: "pi pi-info-circle" },
];

export function getStreetliftingActiveIndex(pathname: string | null) {
    const path = pathname || "";
    const idx = STREETLIFTING_NAV_ITEMS.findIndex(
        (x) => x.href === path || (x.href !== "/streetlifting-index" && path.startsWith(x.href)),
    );
    return idx >= 0 ? idx : 0;
}

