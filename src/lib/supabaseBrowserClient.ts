import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Browser-only Supabase client.
 *
 * IMPORTANT:
 * - Only uses NEXT_PUBLIC_* env vars so we never risk bundling a service role key.
 * - Used for direct uploads to Storage via signed upload tokens.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseBrowser =
    url && anonKey ? createClient<Database>(url, anonKey) : null;

