'use client';

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ShareLandingPage() {
    const router = useRouter();
    const params = useParams<{ shareId?: string | string[] }>();
    const shareIdRaw = params?.shareId;
    const shareId =
        typeof shareIdRaw === "string"
            ? shareIdRaw
            : Array.isArray(shareIdRaw)
                ? shareIdRaw[0]
                : "";

    useEffect(() => {
        if (!shareId) {
            router.replace("/register");
            return;
        }

        const nowIso = new Date().toISOString();

        // 1) Persist attribution locally (robust for WeChat / embedded browsers)
        try {
            localStorage.setItem("share_id", shareId);
        } catch {}

        // 2) Also set a first-party cookie (for server-side fallback)
        try {
            const payload = encodeURIComponent(JSON.stringify({ shareId, ts: nowIso }));
            // 24h
            document.cookie = `share_attribution=${payload}; Max-Age=${24 * 60 * 60}; Path=/; SameSite=Lax`;
        } catch {}

        // 3) Track visit (best-effort)
        fetch("/api/growth/share/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                shareId,
                eventType: "visit",
                meta: {
                    ua: navigator.userAgent,
                    ts: nowIso,
                },
            }),
        }).catch(() => {});

        // 4) Navigate to register with query param for maximum compatibility
        router.replace(`/register?share=${encodeURIComponent(shareId)}`);
    }, [router, shareId]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="text-center space-y-2 px-6">
                <div className="text-surface-900 font-black text-xl">正在跳转注册…</div>
                <div className="text-surface-500 text-sm">
                    将为你保留 24 小时归因，用于发放双方 +2 次 AI 导入与 +100MB 存储奖励
                </div>
            </div>
        </div>
    );
}

