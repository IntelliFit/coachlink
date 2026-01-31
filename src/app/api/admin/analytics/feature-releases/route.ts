import { NextResponse, type NextRequest } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET() {
    const { data, error } = await serviceRoleSupabase
        .from("feature_releases" as any)
        .select("*")
        .order("release_date", { ascending: false });

    if (error) {
        return NextResponse.json<ApiData<null>>({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json<ApiData<any>>({ success: true, data });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { error } = await serviceRoleSupabase
            .from("feature_releases" as any)
            .insert(body);

        if (error) {
            return NextResponse.json<ApiData<null>>({ success: false, message: error.message }, { status: 500 });
        }
        return NextResponse.json<ApiData<null>>({ success: true, message: "created" });
    } catch {
        return NextResponse.json<ApiData<null>>({ success: false, message: "Error" }, { status: 500 });
    }
}
