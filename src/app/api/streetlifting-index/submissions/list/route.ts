import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingListSubmissionsDto,
    StreetliftingListSubmissionsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = await req.json().catch(() => ({} as StreetliftingListSubmissionsDto));
        const {
            limit = 0,
            order = "desc",
            sort_by = "created_at",
        } = body;

        const db = serviceRoleSupabase;
        let query = db
            .from("streetlifting_submissions")
            .select("*")
            .order(sort_by, { ascending: order === "asc" });

        if (limit && limit > 0) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error("[streetlifting-index][submissions] list error:", error);
            return NextResponse.json<ApiData<StreetliftingListSubmissionsResponseDto>>({
                success: false,
                message: error.message || "获取数据失败",
                data: null,
            }, { status: 500 });
        }

        const submissions = (data || []) as any[];
        const userIds = Array.from(new Set(submissions.map((s) => s.user_id).filter(Boolean)));
        type ProfileRow = { user_id: string | null; nickname: string | null; full_name: string | null; avatar_url: string | null };
        let profileMap = new Map<string, { user_name: string | null; user_avatar_url: string | null }>();
        if (userIds.length > 0) {
            const { data: profiles } = await db
                .from("user_profiles")
                .select("user_id,nickname,full_name,avatar_url")
                .in("user_id", userIds);
            (profiles || []).forEach((p: ProfileRow) => {
                const uid = p.user_id;
                if (!uid) return;
                const name = (p.nickname || p.full_name) as string | null;
                const avatar = (p.avatar_url && String(p.avatar_url).trim()) || null;
                profileMap.set(uid, {
                    user_name: name || null,
                    user_avatar_url: avatar,
                });
            });
        }

        const resolved = submissions.map((s) => {
            const uid = s.user_id as string | null;
            if (uid) {
                const row = profileMap.get(uid);
                return {
                    ...s,
                    user_name: row?.user_name || s.user_name || null,
                    user_avatar_url: row?.user_avatar_url ?? null,
                };
            }
            return { ...s, user_avatar_url: null as string | null };
        });

        return NextResponse.json<ApiData<StreetliftingListSubmissionsResponseDto>>({
            success: true,
            message: "获取数据成功",
            data: {
                submissions: resolved,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][submissions] list error:", error);
        return NextResponse.json<ApiData<StreetliftingListSubmissionsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
