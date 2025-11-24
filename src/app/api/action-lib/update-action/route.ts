import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../auth/[...nextauth]/auth';
import { UpdateActionRequest, UpdateActionResponse } from "./entity";
import { ApiData } from "@/types/api";

export async function POST(req: Request) {
  const body: UpdateActionRequest = await req.json();
  const { id, ...updateData } = body;
  
  // Check if user is logged in and has coach role
  const session = await getServerSession();
  const userId = session?.user?.id || null;
  
  if (!userId) {
    return NextResponse.json({ 
      success: false, 
      message: "Unauthorized" 
    }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile || profile.role !== "coach") {
    return NextResponse.json({ 
      success: false, 
      message: "Forbidden" 
    }, { status: 403 });
  }

  // Check if action belongs to this coach
  const { data: existingAction, error: fetchError } = await supabase
    .from("coach_actions")
    .select("id")
    .eq("id", id)
    .eq("coach_id", session.user.id)
    .single();

  if (fetchError || !existingAction) {
    return NextResponse.json({ 
      success: false, 
      message: "Action not found or unauthorized" 
    }, { status: 404 });
  }

  // Update action
  const { data: action, error } = await supabase
    .from("coach_actions")
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("coach_id", session.user.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating action:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Failed to update action" 
    }, { status: 500 });
  }

  const response: UpdateActionResponse = {
    success: true,
    action
  };

  return NextResponse.json<ApiData<UpdateActionResponse>>({
    success: true,
    message: "更新动作成功",
    data: response
  });
}