import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    AddStudentActionDto,
    AddStudentActionResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ItemType, StudentActionRow } from "@/types/student";

export async function POST(req: Request) {
    const addData = await req.json() as AddStudentActionDto;
    console.log("[API] add-action data:", addData);

    // 检查用户登录
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    // 验证必要参数
    if (!addData.name) {
        return NextResponse.json({
            success: false,
            message: "请输入动作名称",
        }, { status: 400 });
    }

    const type: ItemType = addData.type || "STRENGTH";

    // 插入新动作
    const { data: action, error } = await supabase
        .from("student_actions")
        .insert({
            user_id: userId,
            name: addData.name,
            detail: addData.detail || null,
            // 非力量类型一般不需要部位/属性标签
            positions: type === "STRENGTH" ? (addData.positions || ["全身"]) : null,
            attrs: type === "STRENGTH" ? (addData.attrs || ["组数", "次数", "强度", "休息时间"]) : null,
            url: addData.url || null,
            type,
            // Supabase Database 类型中 jsonb 会被推断为 Json，需要做一次断言
            item_schema: (addData.item_schema as unknown as any) || null,
            suggested_time: type === "DIET" ? (addData.suggested_time || null) : null,
            enableAutoWeightCompute: type === "STRENGTH" ? (addData.enableAutoWeightCompute || false) : false,
            includesBodyWeight: type === "STRENGTH" && (addData.enableAutoWeightCompute || false) ? (addData.includesBodyWeight || false) : false,
            canonical_action_id: type === "STRENGTH" ? (addData.canonical_action_id || null) : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Error adding student action:", error);
        return NextResponse.json({
            success: false,
            message: `添加动作失败: ${error.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<AddStudentActionResponseDto>>({
        success: true,
        message: "添加动作成功",
        data: {
            action: action as unknown as StudentActionRow,
        },
    });
}
