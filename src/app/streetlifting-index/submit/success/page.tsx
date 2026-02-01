"use client";

import Link from "next/link";
import { CheckCircle, Calculator, Database } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { StreetliftingDonationSection } from "@/components/streetlifting-index/StreetliftingDonationSection";
import { StreetliftingRecentSubmissions } from "@/components/streetlifting-index/StreetliftingRecentSubmissions";
import { AERO_CARD, AERO_CARD_MUTED, AERO_CONTAINER_4XL, AERO_SUBTITLE, AERO_TITLE } from "@/components/streetlifting-index/aero";

export default function StreetliftingSubmitSuccessPage() {
    return (
        <div className={`${AERO_CONTAINER_4XL} py-8 relative`}>
            {/* 背景装饰：自上而下淡渐变（克制点睛） */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-64" />

            <Card className={`${AERO_CARD} relative overflow-hidden`}>
                <div className="p-6 text-center">
                    <div className="relative inline-flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-primary-100/60 blur-xl" />
                        <div className="relative w-16 h-16 rounded-3xl bg-surface-0 border border-surface-100 flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 text-primary-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-2xl md:text-3xl font-black tracking-tight text-surface-900">提交成功</div>
                    <div className="mt-2 text-sm md:text-base text-surface-600">
                        感谢你为社区贡献数据，每一次提交都会让公式更接近真实世界。
                    </div>

                    <div className="mt-5">
                        <StreetliftingDonationSection variant="success" />
                    </div>
                </div>
            </Card>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className={AERO_CARD}>
                    <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-surface-900 font-black">
                                <div className="w-9 h-9 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center text-surface-700">
                                    <Calculator className="h-5 w-5" />
                                </div>
                                <span>计算我的力量分</span>
                            </div>
                            <Link href="/streetlifting-index/calculator" className="shrink-0">
                                <Button
                                    icon="pi pi-arrow-right"
                                    tooltip="去计算器"
                                    tooltipOptions={{ position: "top" }}
                                    text
                                    severity="secondary"
                                    size="small"
                                    className="w-10 h-10 rounded-2xl text-surface-100 bg-surface-900 hover:bg-surface-800 active:scale-[0.95] transition-all"
                                    aria-label="去计算器"
                                />
                            </Link>
                        </div>
                        <div className="text-sm text-surface-600">用最新系数计算力量分，看看你处在什么段位。</div>
                    </div>
                </Card>

                <Card className={AERO_CARD}>
                    <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-surface-900 font-black">
                                <div className="w-9 h-9 rounded-2xl bg-surface-50 border border-surface-100 flex items-center justify-center text-surface-700">
                                    <Database className="h-5 w-5" />
                                </div>
                                <span>去数据社区看看</span>
                            </div>
                            <Link href="/streetlifting-index/data" className="shrink-0">
                                <Button
                                    icon="pi pi-arrow-right"
                                    tooltip="去数据社区"
                                    tooltipOptions={{ position: "top" }}
                                    text
                                    severity="secondary"
                                    size="small"
                                    className="w-10 h-10 rounded-2xl text-surface-100 bg-surface-900 hover:bg-surface-800 active:scale-[0.95] transition-all"
                                    aria-label="去数据社区"
                                />
                            </Link>
                        </div>
                        <div className="text-sm text-surface-600">浏览其他人提交的数据，按 1RM / 力量分排序。</div>
                    </div>
                </Card>
            </div>

            <div className="mt-10">
                <div className={AERO_TITLE}>最新动态</div>
                <div className={`${AERO_SUBTITLE} mb-4`}>看看社区里刚刚发生了什么</div>
                <StreetliftingRecentSubmissions />
            </div>
        </div>
    );
}

