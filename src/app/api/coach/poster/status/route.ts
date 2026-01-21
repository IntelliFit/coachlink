import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  INVITATION_POSTER_TYPE,
  recoverIfStuckGenerating,
  tryAcquireCoachPosterJob,
  generateInvitationPosterInBackground,
} from "@/lib/coachPoster";

export const runtime = "nodejs";
export const maxDuration = 60;

type PosterStatusResponse = {
  posterType: string;
  status: "queued" | "generating" | "ready" | "failed";
  imageUrl: string | null;
  updatedAt: string;
  lastError: string | null;
};

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json<ApiData<PosterStatusResponse>>(
        { success: false, message: "未登录", data: null },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const posterType = url.searchParams.get("posterType") || INVITATION_POSTER_TYPE;
    if (posterType !== INVITATION_POSTER_TYPE) {
      return NextResponse.json<ApiData<PosterStatusResponse>>(
        { success: false, message: "不支持的海报类型", data: null },
        { status: 400 },
      );
    }

    // Fetch coach by current user
    const { data: coach, error: coachErr } = await serviceRoleSupabase
      .from("coaches")
      .select("id")
      .eq("user_id", session.user.id)
      .single();

    if (coachErr || !coach?.id) {
      return NextResponse.json<ApiData<PosterStatusResponse>>(
        { success: false, message: "您不是教练或教练信息不存在", data: null },
        { status: 403 },
      );
    }

    // Read current row; if missing, create it as queued (only once)
    let row: any = null;
    const { data: existing, error: existingErr } = await serviceRoleSupabase
      .from("coach_posters")
      .select("*")
      .eq("coach_id", coach.id)
      .eq("poster_type", posterType)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing) {
      const { data: created, error: createErr } = await serviceRoleSupabase
        .from("coach_posters")
        .insert({
          coach_id: coach.id,
          poster_type: posterType,
          status: "queued",
          requested_by: session.user.id,
          requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .select("*")
        .single();
      if (createErr) throw createErr;
      row = created;
    } else {
      row = existing;
    }

    // 如果数据库标记为 generating，但当前进程并没有对应生成任务且已超时，则自动回滚为 failed
    // 这样可以处理进程意外中断导致的“假 generating”
    await recoverIfStuckGenerating({ coachId: coach.id, posterType });

    // If queued/failed, try to acquire and start background generation.
    if (row.status === "queued" || row.status === "failed") {
      const acquired = await tryAcquireCoachPosterJob({
        coachId: coach.id,
        posterType,
        requestedBy: session.user.id,
      });

      if (acquired) {
        const origin = await getRequestOrigin();
        const h = await headers();
        const cookieHeader = h.get("cookie") || undefined;
        generateInvitationPosterInBackground({
          coachId: coach.id,
          requestedBy: session.user.id,
          origin,
          cookieHeader,
        });
        // Immediately return "generating"
        return NextResponse.json<ApiData<PosterStatusResponse>>({
          success: true,
          message: "海报生成中",
          data: {
            posterType,
            status: "generating",
            imageUrl: acquired.image_url || null,
            updatedAt: acquired.updated_at,
            lastError: null,
          },
        });
      }
    }

    // Read current status (fresh)
    const { data: current, error: curErr } = await serviceRoleSupabase
      .from("coach_posters")
      .select("poster_type,status,image_url,updated_at,last_error")
      .eq("coach_id", coach.id)
      .eq("poster_type", posterType)
      .single();

    if (curErr || !current) {
      return NextResponse.json<ApiData<PosterStatusResponse>>(
        { success: false, message: "读取海报状态失败", data: null },
        { status: 500 },
      );
    }

    return NextResponse.json<ApiData<PosterStatusResponse>>({
      success: true,
      message: "OK",
      data: {
        posterType: current.poster_type,
        status: current.status,
        imageUrl: current.image_url || null,
        updatedAt: current.updated_at,
        lastError: current.last_error || null,
      },
    });
  } catch (e: any) {
    console.error("[coach-poster] status error:", e);
    return NextResponse.json<ApiData<PosterStatusResponse>>(
      { success: false, message: e?.message || "服务器错误", data: null },
      { status: 500 },
    );
  }
}

