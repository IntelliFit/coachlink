import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { DeleteActionDto, DeleteActionResponseDto } from "./entity";
import type { Database } from "@/types/database.types";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  
  try {
    const { id }: DeleteActionDto = await req.json();
    
    // 验证必要参数
    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少动作ID', data: null },
        { status: 400 }
      );
    }

    // 检查用户登录状态
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, message: '用户未登录', data: null },
        { status: 401 }
      );
    }

    // 检查用户是否为教练角色
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profileError || !profile || profile.role !== "coach") {
      return NextResponse.json(
        { success: false, message: '无权限访问此资源', data: null },
        { status: 403 }
      );
    }

    // 检查动作是否存在且属于该教练（合并查询）
    const { data: existingAction, error: fetchError } = await supabase
      .from("coach_actions")
      .select("id")
      .eq("id", id)
      .eq("coach_id", session.user.id)
      .single();

    if (fetchError || !existingAction) {
      return NextResponse.json(
        { success: false, message: '动作不存在或无权访问', data: null },
        { status: 404 }
      );
    }

    // 删除动作
    const { error: deleteError } = await supabase
      .from("coach_actions")
      .delete()
      .eq("id", id)
      .eq("coach_id", session.user.id);

    if (deleteError) {
      console.error("删除动作失败:", deleteError);
      return NextResponse.json(
        { success: false, message: '删除动作失败', data: null },
        { status: 500 }
      );
    }

    return NextResponse.json<DeleteActionResponseDto>({
      success: true,
      message: '删除动作成功',
      data: null
    });

  } catch (error) {
    console.error("删除动作时发生意外错误:", error);
    return NextResponse.json(
      { success: false, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}