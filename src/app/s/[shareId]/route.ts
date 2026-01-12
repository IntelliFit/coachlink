import { NextRequest, NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

function safeJsonParse<T>(raw: string | undefined | null): T | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { shareId: string } },
) {
    const shareId = params.shareId;
    const url = new URL(request.url);

    // Base URL for redirect (keep same origin)
    const redirectUrl = new URL("/register", url.origin);

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: shareRow, error } = await (supabase as any)
            .from("growth_share_links")
            .select("id, creator_user_id, expires_at")
            .eq("id", shareId)
            .maybeSingle();

        if (error || !shareRow?.id) {
            // Table might not exist or shareId invalid; still allow registration
            return NextResponse.redirect(redirectUrl, 302);
        }

        // Expired: still allow register, but do not set attribution
        const expiresAt = shareRow.expires_at ? new Date(shareRow.expires_at) : null;
        const now = new Date();
        if (expiresAt && expiresAt.getTime() < now.getTime()) {
            return NextResponse.redirect(redirectUrl, 302);
        }

        // Record visit event (await to avoid dropping writes on redirect in some runtimes)
        try {
            await (supabase as any)
                .from("growth_share_events")
                .insert({
                    share_id: shareRow.id,
                    event_type: "visit",
                    meta: {
                        ua: request.headers.get("user-agent") || "",
                        ref: request.headers.get("referer") || "",
                    },
                });
        } catch (evErr) {
            console.warn("Failed to insert growth_share_events:", evErr);
        }

        // Set attribution cookie (24h)
        const attribution = {
            shareId: shareRow.id,
            inviterId: shareRow.creator_user_id,
            ts: now.toISOString(),
        };

        redirectUrl.searchParams.set("share", shareRow.id);

        const res = NextResponse.redirect(redirectUrl, 302);
        res.cookies.set(
            "share_attribution",
            encodeURIComponent(JSON.stringify(attribution)),
            {
                maxAge: 24 * 60 * 60,
                path: "/",
                sameSite: "lax",
            },
        );
        return res;
    } catch (e) {
        // If DB tables missing, just redirect to register
        console.warn("share landing failed:", e);

        // If there is an existing cookie, keep it; otherwise ignore.
        const existing = safeJsonParse(url.searchParams.get("share_attribution"));
        void existing;

        return NextResponse.redirect(redirectUrl, 302);
    }
}

