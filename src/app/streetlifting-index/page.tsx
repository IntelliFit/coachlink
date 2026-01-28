"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Calculator, Database, MapPin, BookOpen } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { StreetliftingDonationSection } from "@/components/streetlifting-index/StreetliftingDonationSection";
import { StreetliftingRecentSubmissions } from "@/components/streetlifting-index/StreetliftingRecentSubmissions";
import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";

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
            <section className="bg-gradient-to-br from-surface-0 via-surface-0 to-primary-50 text-surface-900 border-b border-surface-100">
                <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
                    <div className="flex flex-col items-center text-center gap-6">
                        <div className="w-14 h-14 rounded-3xl bg-primary-100 text-primary-700 flex items-center justify-center shadow-sm">
                            <TrendingUp className="h-8 w-8 stroke-[2.2]" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">街健力量指数</h1>
                            <p className="mt-3 text-sm md:text-lg text-surface-600">
                                世界首创的街健力量评估体系，基于真实数据持续迭代。
                            </p>
                        </div>

                        <div className="w-full max-w-md flex flex-col gap-3">
                            <Link href="/streetlifting-index/calculator">
                                <Button className="w-full" label="计算我的力量分" />
                            </Link>
                            <Link href="/streetlifting-index/data">
                                <Button
                                    className="w-full p-button-outlined p-button-secondary"
                                    label="提交数据 / 查看排行"
                                />
                            </Link>
                        </div>

                        <div className="w-full max-w-sm">
                            <Card className="rounded-3xl border border-surface-100 bg-surface-0 shadow-sm">
                                <div className="p-4">
                                    <div className="text-xs text-surface-600">社区数据总量</div>
                                    {loading ? (
                                        <Skeleton width="60%" height="2rem" className="mt-2" />
                                    ) : (
                                        <div className="text-3xl font-bold mt-2">{stats.totalCount.toLocaleString()}</div>
                                    )}
                                    <div className="text-xs text-surface-500 mt-2">
                                        {stats.lastUpdated
                                            ? `公式更新时间：${new Date(stats.lastUpdated).toLocaleDateString("zh-CN")}`
                                            : "公式更新中"}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>

            <section className="max-w-6xl mx-auto px-4 -mt-8 md:-mt-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { icon: Calculator, title: "力量计算器", desc: "计算力量分", href: "/streetlifting-index/calculator" },
                        { icon: Database, title: "数据社区", desc: "提交与排行", href: "/streetlifting-index/data" },
                        { icon: MapPin, title: "寻找单杠", desc: "附近训练点", href: "/streetlifting-index/locations" },
                        { icon: BookOpen, title: "社区故事", desc: "分享交流", href: "/streetlifting-index/stories" },
                    ].map((item) => (
                        <Link key={item.title} href={item.href}>
                            <Card className="rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.10)] transition-shadow transition-transform active:scale-[0.98]">
                                <div className="p-4 text-center space-y-2">
                                    <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 mx-auto flex items-center justify-center">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <div className="text-sm font-semibold text-surface-900">{item.title}</div>
                                    <div className="text-xs text-surface-500">{item.desc}</div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="max-w-6xl mx-auto px-4 py-10">
                <StreetliftingRecentSubmissions />
            </section>

            <section className="max-w-6xl mx-auto px-4 pb-8">
                <Card className="rounded-3xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 space-y-4">
                        <div className="text-base font-semibold text-surface-900">关注我们</div>
                        <div className="flex flex-col md:flex-row gap-3">
                            <a
                                href="https://space.bilibili.com/495933903"
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 rounded-3xl border border-surface-100 bg-surface-50 p-4 text-sm text-surface-700 text-center hover:bg-surface-100 transition-transform active:scale-[0.98]"
                            >
                                B站 · 枭马葛的主页
                            </a>
                            <a
                                href="https://www.douyin.com/user/MS4wLjABAAAAy7udlkayIqU8bv2_78wy-WnexjBe0yqo1VoKwLlwCmee2p52Wzpdlf2zcoy8pJNm"
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 rounded-3xl border border-surface-100 bg-surface-50 p-4 text-sm text-surface-700 text-center hover:bg-surface-100 transition-transform active:scale-[0.98]"
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
