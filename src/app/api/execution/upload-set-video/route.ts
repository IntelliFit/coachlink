import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import supabase from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import type { UploadSetVideoResponseDto } from "../entity";

/**
 * POST /api/execution/upload-set-video
 *
 * 上传组视频（复用Supabase Storage）
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: "未登录" },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        // 解析FormData
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const executionId = formData.get("executionId") as string;
        const actionId = formData.get("actionId") as string;
        const setNumber = parseInt(formData.get("setNumber") as string);

        if (!file || !executionId || !actionId || !setNumber) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: "缺少参数" },
                { status: 400 },
            );
        }

        // 验证执行记录权限
        const { data: execution } = await supabase
            .from("plan_instance_executions")
            .select("student_id")
            .eq("id", executionId)
            .single();

        if (!execution || execution.student_id !== userId) {
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: "无权限" },
                { status: 403 },
            );
        }

        // 上传到Supabase Storage
        const ext = file.name.split(".").pop() || "mp4";
        const safeName = `${Date.now()}-${uuidv4()}.${ext}`;
        const filePath = `${userId}/executions/${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from("videos")
            .upload(filePath, uint8Array, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("上传失败:", uploadError);
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: "上传失败" },
                { status: 500 },
            );
        }

        // 获取公开URL
        const { data: { publicUrl } } = supabase.storage
            .from("videos")
            .getPublicUrl(filePath);

        // 检查是否已存在视频
        const { data: existing } = await supabase
            .from("execution_set_videos")
            .select("id, storage_path")
            .eq("execution_id", executionId)
            .eq("action_id", actionId)
            .eq("set_number", setNumber)
            .maybeSingle();

        if (existing) {
            // 删除旧视频
            await supabase.storage.from("videos").remove([
                existing.storage_path,
            ]);

            // 更新记录
            const { data } = await supabase
                .from("execution_set_videos")
                .update({
                    video_url: publicUrl,
                    storage_path: filePath,
                    file_size_bytes: file.size,
                    upload_status: "uploaded",
                })
                .eq("id", existing.id)
                .select()
                .single();

            return NextResponse.json<UploadSetVideoResponseDto>({
                success: true,
                data: {
                    id: data!.id,
                    execution_id: data!.execution_id,
                    action_id: data!.action_id,
                    set_number: data!.set_number,
                    video_url: data!.video_url,
                    storage_path: data!.storage_path,
                },
            });
        }

        // 插入新视频记录
        const { data, error: insertError } = await supabase
            .from("execution_set_videos")
            .insert({
                execution_id: executionId,
                action_id: actionId,
                set_number: setNumber,
                video_url: publicUrl,
                storage_path: filePath,
                storage_bucket: "videos",
                file_size_bytes: file.size,
                upload_status: "uploaded",
            })
            .select()
            .single();

        if (insertError) {
            console.error("保存视频记录失败:", insertError);
            return NextResponse.json<UploadSetVideoResponseDto>(
                { success: false, message: "保存失败" },
                { status: 500 },
            );
        }

        return NextResponse.json<UploadSetVideoResponseDto>({
            success: true,
            data: {
                id: data.id,
                execution_id: data.execution_id,
                action_id: data.action_id,
                set_number: data.set_number,
                video_url: data.video_url,
                storage_path: data.storage_path,
            },
        });
    } catch (error) {
        console.error("上传视频失败:", error);
        return NextResponse.json<UploadSetVideoResponseDto>(
            { success: false, message: "服务器错误" },
            { status: 500 },
        );
    }
}
