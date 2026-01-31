import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import redis from "@/lib/redisClient";
import type { ApiData } from "@/types/api";
import type { BindContactDto, BindContactResponseDto } from "./entity";

function isValidPhone(value: string) {
  return /^1[3-9]\d{9}$/.test(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "用户未登录", data: null },
      { status: 401 },
    );
  }

  const body = (await req.json()) as BindContactDto;
  const type = body?.type;
  const value = body?.value?.trim();
  const verifyCode = body?.verifyCode?.trim();

  if (!type || (type !== "phone" && type !== "email")) {
    return NextResponse.json<ApiData<null>>({
      success: false,
      message: "绑定类型不正确",
      data: null,
    });
  }

  if (!value) {
    return NextResponse.json<ApiData<null>>({
      success: false,
      message: type === "phone" ? "手机号不能为空" : "邮箱不能为空",
      data: null,
    });
  }

  if (!verifyCode) {
    return NextResponse.json<ApiData<null>>({
      success: false,
      message: "验证码不能为空",
      data: null,
    });
  }

  if (type === "phone" && !isValidPhone(value)) {
    return NextResponse.json<ApiData<null>>({
      success: false,
      message: "手机号格式不正确",
      data: null,
    });
  }

  if (type === "email" && !isValidEmail(value)) {
    return NextResponse.json<ApiData<null>>({
      success: false,
      message: "邮箱格式不正确",
      data: null,
    });
  }

  // 先做唯一性校验：不允许同一个手机号/邮箱绑定到多个用户
  const { data: existing } = await serviceRoleSupabase
    .from("users")
    .select("id")
    .eq(type, value)
    .neq("id", session.user.id)
    .maybeSingle();

  if (existing?.id) {
    return NextResponse.json<ApiData<null>>({
      success: false,
      message: type === "phone" ? "该手机号已被其他账号绑定" : "该邮箱已被其他账号绑定",
      data: null,
    });
  }

  // 校验验证码
  const isDev = process.env.NODE_ENV === "development";
  const allowMockCode = isDev && verifyCode === "123456";

  if (!allowMockCode) {
    if (!redis) {
      return NextResponse.json<ApiData<null>>(
        { success: false, message: "验证服务不可用", data: null },
        { status: 500 },
      );
    }

    const verificationKey =
      type === "phone"
        ? `sms_verification_code:${value}`
        : `email_verification_code:${value}`;

    const storedCode = await redis.get(verificationKey);
    if (!storedCode) {
      return NextResponse.json<ApiData<null>>({
        success: false,
        message: "验证码已过期或不存在",
        data: null,
      });
    }
    if (storedCode !== verifyCode) {
      return NextResponse.json<ApiData<null>>({
        success: false,
        message: "验证码错误",
        data: null,
      });
    }

    // 防止重复使用
    await redis.del(verificationKey);
  }

  const { error: updateError } = await serviceRoleSupabase
    .from("users")
    .update({
      [type]: value,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", session.user.id);

  if (updateError) {
    return NextResponse.json<ApiData<null>>(
      { success: false, message: "绑定失败，请稍后重试", data: null },
      { status: 500 },
    );
  }

  return NextResponse.json<ApiData<BindContactResponseDto>>({
    success: true,
    message: "绑定成功",
    data: { success: true },
  });
}

