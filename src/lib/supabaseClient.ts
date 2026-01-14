import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

// Prefer server-safe vars, but fall back to common Supabase env names to avoid
// "works locally but fails in deployment" due to mismatched env variable names.
const NEXT_SUPABASE_URL =
    process.env.NEXT_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
const NEXT_SUPABASE_ANON_KEY =
    process.env.NEXT_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
const NEXT_SUPABASE_SERVICE_ROLE_KEY =
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';

const supabase = createClient<Database>(NEXT_SUPABASE_URL, NEXT_SUPABASE_ANON_KEY);
const serviceRoleSupabase = createClient<Database>(NEXT_SUPABASE_URL, NEXT_SUPABASE_SERVICE_ROLE_KEY);

export default supabase;
export { serviceRoleSupabase };
