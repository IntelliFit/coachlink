"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Calculator, Database, MapPin, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { StreetliftingDonationSection } from "@/components/streetlifting-index/StreetliftingDonationSection";
import { StreetliftingRecentSubmissions } from "@/components/streetlifting-index/StreetliftingRecentSubmissions";
import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";
import { AERO_CARD, AERO_CARD_MUTED, AERO_CONTAINER_6XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";

export default function StreetliftingHomePage() {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCount: 0,
        lastUpdated: null as string | null,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await streetliftingIndexService.getStats();
                if (data) {
                    setStats({
                        totalCount: data.totalCount || 0,
                        lastUpdated: data.lastUpdated || null,
                    });
                }
            } catch (error: any) {
                console.error("[streetlifting-index] stats error:", error);
                showToast({ severity: "warn", summary: "提示", detail: "统计数据获取失败" });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [showToast]);

    return (
        <div>
            {/* 背景装饰：自上而下的淡淡渐变（对齐 coach/profile 的范式），仅作用于首页 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/50 to-transparent dark:from-primary-800/50" />

            <div className="relative z-10">
                <section className="text-surface-900">
                <div className={`${AERO_CONTAINER_6XL} py-10 md:py-14`}>
                    {/* 数据块：左侧叙述 + 右侧核心数据（PC 下更像成熟生态站的“指标面板”） */}
                    <div className="rounded-[28px]">
                        <div className="p-5 md:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 md:items-center">
                            <div className="md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left gap-5">
                                <div className="flex gap-3">
                                <div className="w-14 h-14 rounded-3xl bg-surface-900 text-surface-0 flex items-center justify-center shadow-sm">
                                    <TrendingUp className="h-8 w-8 stroke-[2.2]" />
                                </div>

                                <div className="max-w-xl">
                                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight">街健力量指数</h1>
                                    <p className={`${AERO_SUBTITLE} mt-2 md:mt-2 text-sm md:text-base`}>
                                        世界首创的街健力量评估体系，基于真实数据持续迭代。
                                    </p>
                                </div>
                                </div>

                                <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Link href="/streetlifting-index/calculator">
                                        <Button
                                            label="计算我的力量分"
                                            size="small"
                                            className="w-full h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                                        />
                                    </Link>
                                    <Link href="/streetlifting-index/data">
                                        <Button
                                            outlined
                                            severity="secondary"
                                            size="small"
                                            className="w-full h-10 rounded-2xl border-surface-200 text-surface-800 text-sm font-black hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                                            label="提交数据 / 查看排行"
                                        />
                                    </Link>
                                </div>
                            </div>

                            <div className="md:col-span-5">
                                <div className="rounded-3xl border border-surface-100 bg-surface-50 p-5 md:p-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-surface-500 uppercase">
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                            社区数据总量
                                        </div>
                                        <div className="text-[11px] text-surface-400 font-medium">
                                            {stats.lastUpdated
                                                ? `更新：${new Date(stats.lastUpdated).toLocaleDateString("zh-CN")}`
                                                : "更新中"}
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div className="mt-4 space-y-3">
                                            <Skeleton width="80%" height="3.5rem" />
                                            <Skeleton width="40%" height="0.75rem" />
                                        </div>
                                    ) : (
                                        <div className="mt-4">
                                            <div className="text-5xl md:text-6xl font-black tracking-tight text-surface-900">
                                                {stats.totalCount.toLocaleString()}
                                            </div>
                                            <div className="mt-2 text-xs text-surface-500 font-medium">
                                                条社区数据已被用于构建与校准评分体系
                                            </div>
                                            <div className="mt-4 h-1 w-16 rounded-full bg-primary-500/60" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            </div>

            <section className={`${AERO_CONTAINER_6XL} -mt-8 md:-mt-10`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { icon: Calculator, title: "力量计算器", desc: "计算力量分", href: "/streetlifting-index/calculator" },
                        { icon: Database, title: "数据社区", desc: "提交与排行", href: "/streetlifting-index/data" },
                        { icon: MapPin, title: "寻找单杠", desc: "附近训练点", href: "/streetlifting-index/locations" },
                        { icon: BookOpen, title: "社区故事", desc: "分享交流", href: "/streetlifting-index/stories" },
                    ].map((item) => (
                        <Link
                            key={item.title}
                            href={item.href}
                            className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-50"
                        >
                            <Card className={`${AERO_CARD} border-surface-100 group-hover:border-surface-200 transform-gpu group-hover:-translate-y-0.5 transition-[box-shadow,transform,border-color] active:scale-[0.98]`}>
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-surface-50 text-surface-700 flex items-center justify-center border border-surface-100 group-hover:bg-surface-0 group-hover:border-primary-200/70 transition-colors">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <div className="mt-1 text-surface-300 group-hover:text-primary-500 transition-colors">
                                            <ArrowRight className="h-4 w-4" />
                                        </div>
                                    </div>

                                    <div className="mt-3 space-y-1">
                                        <div className="text-sm font-black text-surface-900 line-clamp-1">{item.title}</div>
                                        <div className="text-xs font-medium text-surface-500 line-clamp-1">{item.desc}</div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={`${AERO_CONTAINER_6XL} py-10`}>
                <StreetliftingRecentSubmissions />
            </section>

            <section className={`${AERO_CONTAINER_6XL} pb-8`}>
                <Card className={AERO_CARD}>
                    <div className="p-6 space-y-4">
                        <div className={AERO_TITLE}>关注我们</div>
                        <div className="flex flex-col md:flex-row gap-3">
                            <a
                                href="https://space.bilibili.com/495933903"
                                target="_blank"
                                rel="noreferrer"
                                className={`${AERO_CARD_MUTED} flex-1 p-4 text-sm font-semibold text-surface-700 text-center hover:bg-surface-100 transition-transform active:scale-[0.98]`}
                            >
                                B站 · 枭马葛的主页
                            </a>
                            <a
                                href="https://www.douyin.com/user/MS4wLjABAAAAy7udlkayIqU8bv2_78wy-WnexjBe0yqo1VoKwLlwCmee2p52Wzpdlf2zcoy8pJNm"
                                target="_blank"
                                rel="noreferrer"
                                className={`${AERO_CARD_MUTED} flex-1 p-4 text-sm font-semibold text-surface-700 text-center hover:bg-surface-100 transition-transform active:scale-[0.98]`}
                            >
                                抖音 · 枭马葛的主页
                            </a>
                        </div>
                    </div>
                </Card>
            </section>

            <StreetliftingDonationSection />
            <div className="h-8" />
        </div>
    );
}
