import { serviceRoleSupabase } from "@/lib/supabaseClient";

export function normalizeAdminLoginIdentifier(identifier: string) {
    return identifier.trim().toLowerCase();
}

export async function getAdminCredentialByLoginIdentifier(loginIdentifier: string) {
    const normalized = normalizeAdminLoginIdentifier(loginIdentifier);
    if (!normalized) return null;

    const { data, error } = await serviceRoleSupabase
        .from("admin_users")
        .select("id, user_id, role, permissions, login_identifier, password_hash, is_active")
        .eq("login_identifier", normalized)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function getAdminCredentialByUserId(userId: string) {
    const { data, error } = await serviceRoleSupabase
        .from("admin_users")
        .select("id, user_id, role, permissions, login_identifier, password_hash, is_active")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function hasStandaloneAdminCredentialForUserId(userId: string) {
    const credential = await getAdminCredentialByUserId(userId);
    return Boolean(
        credential?.is_active !== false &&
        credential?.login_identifier &&
        credential?.password_hash,
    );
}
