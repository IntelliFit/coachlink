import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { applyAdjustmentDraft } from "@/lib/coachingAutomation";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ success: false, message: "Missing draft id" }, { status: 400 });
  }

  try {
    const draft = await applyAdjustmentDraft(id, session.user.id);
    return NextResponse.json({ success: true, data: { draft } });
  } catch (error: any) {
    const message = error?.message || "Failed to apply adjustment draft";
    const status = message === "forbidden" ? 403 : message === "draft_not_found" ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
