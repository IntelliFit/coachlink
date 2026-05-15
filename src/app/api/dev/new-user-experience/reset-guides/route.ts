import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";

export async function POST() {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ENABLE_NEW_USER_AUDIT_API !== "true"
  ) {
    return NextResponse.json(
      { success: false, message: "Not available outside development" },
      { status: 404 },
    );
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      guides_completed: {},
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    guidesCompleted: {},
  });
}
