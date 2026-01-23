import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { event_name, event_category, event_data, page_path, device_type } = body;

        if (!event_name || !event_category) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "Missing required fields: event_name, event_category" },
                { status: 400 }
            );
        }

        const session = await getServerSession();
        
        let userId = session?.user?.id;
        // 使用 any 绕过类型检查
        let userType = (session?.user as any)?.primary_role || "student";

        if (!userId && body.user_id) {
             userId = body.user_id; 
             if (body.user_type) userType = body.user_type;
        }

        if (!userId) {
             return NextResponse.json<ApiData<null>>(
                { success: false, message: "User not authenticated" },
                { status: 401 }
            );
        }

        const { error } = await serviceRoleSupabase
            .from("user_behavior_events" as any)
            .insert({
                user_id: userId,
                user_type: userType,
                event_name,
                event_category,
                event_data,
                page_path,
                device_type: device_type || "web",
                session_id: body.session_id,
            });

        if (error) {
            console.error("Track error:", error);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "Failed to store event" },
                { status: 500 }
            );
        }

        return NextResponse.json<ApiData<null>>({ success: true, message: "ok" });
    } catch (err) {
        console.error("Track exception:", err);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
