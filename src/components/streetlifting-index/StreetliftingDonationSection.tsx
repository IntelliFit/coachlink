"use client";

import { useState } from "react";
import { Heart, Maximize2 } from "lucide-react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { AERO_CARD } from "@/components/streetlifting-index/aero";

export function StreetliftingDonationSection({
    variant = "footer",
}: {
    variant?: "footer" | "page" | "success";
}) {
    const [expanded, setExpanded] = useState(variant !== "footer");
    const [showDialog, setShowDialog] = useState(false);

    const content = (
        <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
                <div className="relative">
                    <img
                        src="/streetlifting-index/donation-qr.png"
                        alt="赞赏码"
                        className="w-56 h-56 rounded-2xl border border-surface-100 bg-surface-0 shadow-sm cursor-zoom-in transition-transform active:scale-[0.98]"
                        onClick={() => setShowDialog(true)}
                    />
                    <div className="absolute top-2 right-2 bg-surface-900/70 text-surface-0 rounded-full p-1.5">
                        <Maximize2 className="h-4 w-4" />
                    </div>
                </div>
            </div>
            <div className="text-sm text-surface-600 leading-relaxed">
                项目完全免费运行，但服务器与存储成本持续增长。
                如果你愿意支持街健社区的发展，欢迎扫码请小马哥喝杯咖啡。
            </div>
        </div>
    );

    return (
        <div className="w-full">
            {variant === "footer" && (
                <div className="bg-surface-50 border-t border-surface-100 py-8">
                    <div className="max-w-5xl mx-auto px-4">
                        <div className="flex flex-col items-center gap-4">
                            <Button
                                label={expanded ? "收起打赏信息" : "支持项目发展"}
                                icon="pi pi-heart"
                                className="p-button-rounded p-button-text !text-surface-700 hover:!text-surface-900 transition-transform active:scale-[0.98]"
                                onClick={() => setExpanded((prev) => !prev)}
                            />
                            {expanded && (
                                <Card className={`w-full md:w-2/3 ${AERO_CARD}`}>
                                    <div className="p-6">{content}</div>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {variant !== "footer" && (
                <div className="p-6">
                    <div className="flex items-center justify-center gap-2 text-surface-900 font-semibold mb-4">
                        <Heart className="h-5 w-5 text-surface-700" />
                        支持项目持续运行
                    </div>
                    {content}
                </div>
            )}

            <Dialog
                header="赞赏码"
                visible={showDialog}
                onHide={() => setShowDialog(false)}
                className="w-[90vw] md:w-[28rem]"
                draggable={false}
            >
                <div className="flex items-center justify-center py-4">
                    <img
                        src="/streetlifting-index/donation-qr.png"
                        alt="赞赏码大图"
                        className="w-72 h-72 rounded-2xl border border-surface-100 bg-surface-0"
                    />
                </div>
            </Dialog>
        </div>
    );
}
