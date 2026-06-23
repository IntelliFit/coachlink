import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
  INVITATION_POSTER_TYPE,
  upsertCoachPosterQueued,
  tryAcquireCoachPosterJob,
  generateInvitationPosterInBackground,
} from "@/lib/coachPoster";

export const runtime = "nodejs";
export const maxDuration = 60;

type TriggerPosterDto = {
  posterType?: string;
};

type TriggerPosterResponse = {
  posterType: string;
  status: "queued" | "generating" | "ready" | "failed";
};

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    const authUser = session?.user?.id ? { userId: session.user.id } : await getAuthUser(req);

    if (!authUser.userId) {
      return NextResponse.json<ApiData<TriggerPosterResponse>>(
        { success: false, message: "未登录", data: null },
        { status: 401 },
      );
    }

    let body: TriggerPosterDto = {};
    try {
      body = (await req.json()) as TriggerPosterDto;
    } catch {
      body = {};
    }

    const posterType = body.posterType || INVITATION_POSTER_TYPE;
    if (posterType !== INVITATION_POSTER_TYPE) {
      return NextResponse.json<ApiData<TriggerPosterResponse>>(
        { success: false, message: "不支持的海报类型", data: null },
        { status: 400 },
      );
    }

    const { data: coach, error: coachErr } = await serviceRoleSupabase
      .from("coaches")
      .select("id")
      .eq("user_id", authUser.userId)
      .single();

    if (coachErr || !coach?.id) {
      return NextResponse.json<ApiData<TriggerPosterResponse>>(
        { success: false, message: "您不是教练或教练信息不存在", data: null },
        { status: 403 },
      );
    }

    const queued = await upsertCoachPosterQueued({
      coachId: coach.id,
      posterType,
      requestedBy: authUser.userId,
    });

      const acquired = await tryAcquireCoachPosterJob({
        coachId: coach.id,
        posterType,
        requestedBy: authUser.userId,
      });

    if (acquired) {
      const origin = await getRequestOrigin();
      const h = await headers();
      const cookieHeader = h.get("cookie") || undefined;
      generateInvitationPosterInBackground({
        coachId: coach.id,
        requestedBy: authUser.userId,
        origin,
        cookieHeader,
      });
      return NextResponse.json<ApiData<TriggerPosterResponse>>({
        success: true,
        message: "已开始生成",
        data: { posterType, status: "generating" },
      });
    }

    return NextResponse.json<ApiData<TriggerPosterResponse>>({
      success: true,
      message: "已排队",
      data: { posterType, status: queued.status },
    });
  } catch (e: any) {
    console.error("[coach-poster] trigger error:", e);
    return NextResponse.json<ApiData<TriggerPosterResponse>>(
      { success: false, message: e?.message || "服务器错误", data: null },
      { status: 500 },
    );
  }
}
