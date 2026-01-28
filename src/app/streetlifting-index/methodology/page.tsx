import Link from "next/link";
import { BarChart3, Calculator, Database, Shield, TrendingUp, Users } from "lucide-react";
import { Card } from "primereact/card";

export default function StreetliftingMethodologyPage() {
    return (
        <div className="min-h-screen bg-surface-50">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 text-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary-700">
                            <TrendingUp className="h-7 w-7" />
                        </div>
                        <div className="mt-4 text-2xl md:text-3xl font-bold tracking-tight text-surface-900">方法论</div>
                        <div className="mt-2 text-sm md:text-base text-surface-600">
                            了解「街健力量指数」的计算逻辑、数据标准与透明原则。
                        </div>
                        <div className="mt-4 text-sm text-surface-600">
                            快速入口：{" "}
                            <Link href="/streetlifting-index/calculator" className="text-primary-700 hover:underline">
                                计算器
                            </Link>{" "}
                            ·{" "}
                            <Link href="/streetlifting-index/data" className="text-primary-700 hover:underline">
                                数据社区
                            </Link>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-surface-900">
                            <Users className="h-5 w-5 text-primary-600" />
                            项目概述
                        </div>
                        <div className="text-sm text-surface-700 leading-relaxed">
                            街健力量指数是一个社区驱动的公开项目：通过收集真实训练数据，构建一套能跨体重比较的力量评估标准。
                            核心目标是「公平」「透明」「可迭代」。
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                <div className="text-sm font-semibold text-surface-900">核心目标</div>
                                <ul className="mt-2 text-sm text-surface-600 space-y-1">
                                    <li>- 体重标准化的力量评估体系</li>
                                    <li>- 公开可验证的计算方法</li>
                                    <li>- 公式可随数据增长持续优化</li>
                                </ul>
                            </div>
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                <div className="text-sm font-semibold text-surface-900">社区价值</div>
                                <ul className="mt-2 text-sm text-surface-600 space-y-1">
                                    <li>- 每个人的数据都有价值</li>
                                    <li>- 数据与算法透明可追溯</li>
                                    <li>- 共同推动街健科学化</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-surface-900">
                            <Database className="h-5 w-5 text-primary-600" />
                            数据收集与处理
                        </div>
                        <div className="text-sm text-surface-700 leading-relaxed">
                            数据提交遵循最小必要原则：只收集与训练表现相关的字段，不采集实名身份信息。
                        </div>
                        <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                            <div className="text-sm font-semibold text-surface-900">核心字段</div>
                            <div className="mt-2 text-sm text-surface-600 space-y-1">
                                <div>- 基础信息：性别、体重</div>
                                <div>- 成绩数据：附加负重、完成次数</div>
                                <div>- 质量评估：动作标准等级（影响惩罚）</div>
                                <div>- 可选项：昵称/社媒、视频链接</div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-surface-900">
                            <Shield className="h-5 w-5 text-primary-600" />
                            动作质量惩罚机制
                        </div>
                        <div className="text-sm text-surface-700 leading-relaxed">
                            为了让数据更接近「比赛级标准」，我们引入惩罚重量（用户自评区间）。
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                <div className="text-sm font-semibold text-surface-900">等级与惩罚</div>
                                <div className="mt-2 text-sm text-surface-600 space-y-1">
                                    <div>- 比赛级：0kg</div>
                                    <div>- 轻微借力：2-5kg</div>
                                    <div>- 严重借力：5-20kg</div>
                                    <div>- 超严重借力：20-50kg</div>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                <div className="text-sm font-semibold text-surface-900">计算方式</div>
                                <div className="mt-2 text-sm text-surface-600">
                                    调整后负重 = 原始附加负重 - 惩罚重量
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-surface-900">
                            <Calculator className="h-5 w-5 text-primary-600" />
                            1RM 估算（综合三公式）
                        </div>
                        <div className="text-sm text-surface-700 leading-relaxed">
                            为减少单一公式在不同次数区间的偏差，我们取 Epley / Brzycki / Lombardi 三种估算的平均值。
                            次数为 1 时，直接等于实际重量。
                        </div>
                        <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4 text-sm text-surface-700">
                            <div className="font-semibold text-surface-900 mb-2">核心公式（Total_Weight 为“体重 + 调整后负重”）</div>
                            <div className="space-y-1">
                                <div>- Epley: Total_1RM = Total_Weight × (1 + 0.0333 × Reps)</div>
                                <div>- Brzycki: Total_1RM = Total_Weight × (36 / (37 - Reps))</div>
                                <div>- Lombardi: Total_1RM = Total_Weight × (Reps ^ 0.1)</div>
                                <div className="pt-1">最终：三者平均</div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border border-surface-100 bg-surface-0 shadow-sm">
                    <div className="p-6 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-surface-900">
                            <BarChart3 className="h-5 w-5 text-primary-600" />
                            体重标准化系数与最终分数
                        </div>
                        <div className="text-sm text-surface-700 leading-relaxed">
                            上肢动作（负重引体/臂屈伸）使用体重相关系数 \(C(W)\) 进行标准化，最终分数为：
                        </div>
                        <div className="rounded-2xl border border-surface-100 bg-surface-50 p-4 text-sm text-surface-700">
                            力量分 = 总重量 1RM × C(W)
                        </div>
                        <div className="text-sm text-surface-600">
                            说明：负重臂屈伸在旧模型中会额外做一次比例调整（目前按历史规则 / 1.3）。
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

