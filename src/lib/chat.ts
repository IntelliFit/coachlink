import { NextResponse } from "next/server";
import supabase from "./supabaseClient";

export async function getAdmin() {
    const { data: admin, error } = await supabase.from('admin_users').select('*').limit(1).single();
    if (error) {
        console.error(error);
        return null;
    }

    return admin;
}

export async function sendSystemMessage(
    coachId: string,
) {
    const admin = await getAdmin();

    if (!admin) {
        return false;
    }

}