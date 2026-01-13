import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { ApiData } from "@/types/api";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

export interface InviteInfo {
    inviteCode: string;
    inviteLink: string;
    shareText: string;
    inviter: {
        nickname: string | null;
        avatarUrl: string | null;
    };
    posterStats: {
        /** 累计训练天数（按北京时间，按完成训练的“日期去重”） */
        trainingDays: number;
        /** 累计完成训练次数（completed sessions） */
        totalTrainings: number;
        /** 累计完成组数（completed_sets 汇总） */
        totalSets: number;
        /** 最近 30 天 PR 次数（date_achieved 口径） */
        monthPrCount: number;
        /** 最新 PR（任意动作） */
        latestPr?: {
            exerciseName: string;
            weight: number | null;
            reps: number | null;
            e1rm: number | null;
            loadFormula: string | null;
            dateAchieved: string | null;
        } | null;
    };
}

function beijingDateKeyFromIso(iso: string) {
    // Convert UTC timestamp to Beijing date (UTC+8), then take YYYY-MM-DD
    const ms = new Date(iso).getTime();
    const beijingMs = ms + 8 * 60 * 60 * 1000;
    return new Date(beijingMs).toISOString().slice(0, 10);
}

function beijingTodayDateKey() {
    const beijingMs = Date.now() + 8 * 60 * 60 * 1000;
    return new Date(beijingMs).toISOString().slice(0, 10);
}

function minusDaysBeijingDateKey(days: number) {
    const beijingMs = Date.now() + 8 * 60 * 60 * 1000;
    const target = new Date(beijingMs - days * 24 * 60 * 60 * 1000);
    return target.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;
    // For MVP, we use userId as the invite code.
    // In future, we can generate a short alphanumeric code and store it in user_profiles.
    const inviteCode = userId;

    // Prefer explicit base URL; otherwise infer from request headers to avoid leaking localhost in production.
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost || request.headers.get("host");
    const proto = forwardedProto || "http";
    const inferredBaseUrl = host ? `${proto}://${host}` : "http://localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || inferredBaseUrl;

    // For WeChat / Chinese social share, prefer QR landing page (/s/<shareId>) over raw link params.
    // This uses the same growth attribution flow as training share cards.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: shareRow, error: shareErr } = await (serviceRoleSupabase as any)
        .from("growth_share_links")
        .insert({
            creator_user_id: userId,
            execution_id: null,
            expires_at: expiresAt,
            meta: { channel: "invite_poster" },
        })
        .select("id")
        .single();

    const shareId = shareRow?.id as string | undefined;
    const inviteLink = shareId ? `${baseUrl}/s/${shareId}` : `${baseUrl}/register?ref=${inviteCode}`;

    const shareText =
        `这是我在 CoachLink 的训练战报，扫码一起训练：${inviteLink}`;

    if (shareErr) {
        console.warn("[referral] failed to create invite_poster share link, fallback to ref link:", shareErr);
    }

    // --- Build inviter profile (best-effort) ---
    const { data: profile } = await serviceRoleSupabase
        .from("user_profiles")
        .select("nickname, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

    const inviter = {
        nickname: (profile as any)?.nickname ?? null,
        avatarUrl: (profile as any)?.avatar_url ?? null,
    };

    // --- Compute poster stats (Beijing time) ---
    const trainingDays = new Set<string>();
    let totalTrainings = 0;
    let totalSets = 0;

    // New execution system
    const { data: execs } = await serviceRoleSupabase
        .from("plan_instance_executions")
        .select("completed_at, status, completed_sets")
        .eq("student_id", userId)
        .eq("status", "completed");

    (execs || []).forEach((e: any) => {
        if (e?.completed_at) {
            trainingDays.add(beijingDateKeyFromIso(e.completed_at));
        }
        totalTrainings += 1;
        totalSets += Number(e?.completed_sets || 0);
    });

    // Legacy training records (compat)
    const { data: records } = await serviceRoleSupabase
        .from("training_records")
        .select("training_date, status, completed_sets")
        .eq("user_id", userId)
        .eq("status", "completed");

    (records || []).forEach((r: any) => {
        if (r?.training_date) {
            // training_date is a DATE string (already local-like); treat as day key
            trainingDays.add(String(r.training_date));
        }
        totalTrainings += 1;
        totalSets += Number(r?.completed_sets || 0);
    });

    // PR stats
    const prStartDate = minusDaysBeijingDateKey(30);
    const { data: prMonth } = await serviceRoleSupabase
        .from("personal_records_history")
        .select("id, date_achieved")
        .eq("user_id", userId)
        .gte("date_achieved", prStartDate);

    const monthPrCount = (prMonth || []).length;

    const { data: latestPrRow } = await serviceRoleSupabase
        .from("personal_records_history")
        .select("exercise_name, weight, reps, e1rm, load_formula, date_achieved, created_at")
        .eq("user_id", userId)
        .order("date_achieved", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const latestPr = latestPrRow
        ? {
            exerciseName: (latestPrRow as any).exercise_name as string,
            weight: (latestPrRow as any).weight ?? null,
            reps: (latestPrRow as any).reps ?? null,
            e1rm: (latestPrRow as any).e1rm ?? null,
            loadFormula: (latestPrRow as any).load_formula ?? null,
            dateAchieved: (latestPrRow as any).date_achieved ?? null,
        }
        : null;

    const posterStats = {
        trainingDays: trainingDays.size,
        totalTrainings,
        totalSets,
        monthPrCount,
        latestPr,
    };

    return NextResponse.json<ApiData<InviteInfo>>({
        success: true,
        message: "获取邀请信息成功",
        data: {
            inviteCode,
            inviteLink,
            shareText,
            inviter,
            posterStats,
        },
    });
}
