import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

// GET: Fetch user's completed guides
export async function GET() {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, {
                status: 401,
            });
        }

        const { data, error } = await supabase
            .from("user_profiles")
            .select("guides_completed")
            .eq("user_id", session.user.id)
            .single();

        if (error) {
            console.error("Error fetching guides_completed:", error);
            return NextResponse.json({ guidesCompleted: {} });
        }

        return NextResponse.json({
            guidesCompleted: data?.guides_completed || {},
        });
    } catch (error) {
        console.error("Error in guides-completed GET:", error);
        return NextResponse.json({ error: "Internal server error" }, {
            status: 500,
        });
    }
}

// POST: Mark a guide as complete
export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, {
                status: 401,
            });
        }

        const { guideKey } = await request.json();

        if (!guideKey || typeof guideKey !== "string") {
            return NextResponse.json({ error: "Invalid guideKey" }, {
                status: 400,
            });
        }

        // Fetch current guides_completed
        const { data: currentData } = await supabase
            .from("user_profiles")
            .select("guides_completed")
            .eq("user_id", session.user.id)
            .single();

        const currentGuides = currentData?.guides_completed || {};
        const updatedGuides = { ...currentGuides, [guideKey]: true };

        // Update with merged data
        const { error } = await supabase
            .from("user_profiles")
            .update({ guides_completed: updatedGuides })
            .eq("user_id", session.user.id);

        if (error) {
            console.error("Error updating guides_completed:", error);
            return NextResponse.json({ error: "Failed to update" }, {
                status: 500,
            });
        }

        return NextResponse.json({
            success: true,
            guidesCompleted: updatedGuides,
        });
    } catch (error) {
        console.error("Error in guides-completed POST:", error);
        return NextResponse.json({ error: "Internal server error" }, {
            status: 500,
        });
    }
}
