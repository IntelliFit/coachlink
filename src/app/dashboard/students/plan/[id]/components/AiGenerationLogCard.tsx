"use client";

import { Card } from "primereact/card";
import { Badge } from "primereact/badge";

interface AiGenerationLogCardProps {
    aiGenerationLog: any;
}

export function AiGenerationLogCard({ aiGenerationLog }: AiGenerationLogCardProps) {
    if (!aiGenerationLog) return null;

    const stageA = aiGenerationLog.stageA;
    const stageB = aiGenerationLog.stageB;

    return (
        <Card
            className="border border-surface-200 rounded-2xl shadow-sm"
            pt={{ content: { className: "p-4" } }}
        >
            <div className="flex items-center gap-2 mb-3">
                <i className="pi pi-sparkles text-purple-500" />
                <span className="font-bold text-surface-900">AI 个性化生成记录</span>
                <Badge value="AI" severity="info" className="ml-auto" />
            </div>

            {stageA && (
                <div className="mb-3 p-3 bg-surface-50 rounded-lg">
                    <div className="text-xs font-medium text-surface-500 mb-1">
                        模板选择理由
                    </div>
                    <div className="text-sm text-surface-800 leading-relaxed">
                        {stageA.reasoning || "未记录"}
                    </div>
                    {stageA.templateId && (
                        <div className="mt-1 text-xs text-surface-400">
                            选中模板：{stageA.templateId}
                        </div>
                    )}
                </div>
            )}

            {stageB && (
                <div className="p-3 bg-surface-50 rounded-lg">
                    <div className="text-xs font-medium text-surface-500 mb-1">
                        个性化调整说明
                    </div>
                    <div className="text-sm text-surface-800 leading-relaxed">
                        {stageB.reasoning || "未记录"}
                    </div>
                    {stageB.changesSummary && (
                        <div className="mt-2 text-xs text-surface-500">
                            <i className="pi pi-list mr-1" />
                            {stageB.changesSummary}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
