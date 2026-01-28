import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "街健力量指数 | CoachLink",
    description: "街健力量指数：社区驱动的数据体系，提供力量分计算、数据提交与排行、找单杠与社区故事。",
};

export default function StreetliftingIndexLayout({ children }: { children: React.ReactNode }) {
    // 使用全站 NavigationStudent / NavigationCoach 的既有设计逻辑，不额外包一层独立 Shell
    return children;
}

