import { NextResponse } from 'next/server';
import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { GetActionRequest, GetActionResponse } from "./entity";
import { Database } from "@/types/database.types";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  
  try {
    const { id }: GetActionRequest = await req.json();
    
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

    // Fetch action
    const { data: action, error } = await supabase
      .from("coach_actions")
      .select("*")
      .eq("id", id)
      .eq("coach_id", session.user.id)
      .single();

    if (error) {
      console.error("Error fetching action:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Failed to fetch action" 
      }), { status: 500 });
    }

    if (!action) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Action not found" 
      }), { status: 404 });
    }

    const response: GetActionResponse = {
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
