"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle, Calculator, Database } from "lucide-react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { StreetliftingDonationSection } from "@/components/streetlifting-index/StreetliftingDonationSection";
import { StreetliftingRecentSubmissions } from "@/components/streetlifting-index/StreetliftingRecentSubmissions";

export default function StreetliftingSubmitSuccessPage() {
    const [pulse, setPulse] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setPulse(false), 2200);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="min-h-screen bg-surface-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="text-center">
                    <div className="relative inline-flex items-center justify-center">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                        {pulse && (
                            <span className="absolute inline-flex h-16 w-16 rounded-full bg-green-400 opacity-30 animate-ping" />
                        )}
                    </div>
                    <div className="mt-4 text-2xl md:text-3xl font-bold tracking-tight text-surface-900">
                        提交成功！
                    </div>
                    <div className="mt-2 text-sm md:text-base text-surface-600">
                        感谢你为社区贡献宝贵的数据，你的每一次提交都会让公式更接近真实世界。
                    </div>
                </div>

                <div className="mt-8">
                    <StreetliftingDonationSection variant="success" />
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-surface-900 font-semibold">
                                <Calculator className="h-5 w-5 text-primary-600" />
                                计算我的力量分
                            </div>
                            <div className="text-sm text-surface-600">
                                使用最新系数计算力量分，看看你处在什么段位。
                            </div>
                            <Link href="/streetlifting-index/calculator">
                                <Button className="w-full" label="去计算器" />
                            </Link>
                        </div>
                    </Card>

                    <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-surface-900 font-semibold">
                                <Database className="h-5 w-5 text-primary-600" />
                                去数据社区看看
                            </div>
                            <div className="text-sm text-surface-600">
                                浏览其他人提交的数据，按 1RM / 力量分排序。
                            </div>
                            <Link href="/streetlifting-index/data">
                                <Button className="w-full p-button-outlined" label="去数据社区" />
                            </Link>
                        </div>
                    </Card>
                </div>

                <div className="mt-10">
                    <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                        <div className="p-6">
                            <div className="text-base font-semibold text-surface-900 mb-4">看看最新动态</div>
                            <StreetliftingRecentSubmissions />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

