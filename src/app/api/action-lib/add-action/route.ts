import { NextResponse } from 'next/server';
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { AddActionRequest, AddActionResponse } from "./entity";
import { Database } from "@/types/database.types";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  
  try {
    const body: AddActionRequest = await req.json();
    
    // Check if user is logged in and has coach role
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!profile || profile.role !== "coach") {
      return new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 });
    }

    // Insert new action
    const { data: action, error } = await supabase
      .from("coach_actions")
      .insert({
        ...body,
        coach_id: session.user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding action:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Failed to add action" 
      }), { status: 500 });
    }

    const response: AddActionResponse = {
      success: true,
      action
    };

    return new Response(JSON.stringify(response), { status: 200 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "Internal server error" 
    }), { status: 500 });
  }
}
