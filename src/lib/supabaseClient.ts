import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

const NEXT_SUPABASE_URL = process.env.NEXT_SUPABASE_URL || '';
const NEXT_SUPABASE_ANON_KEY = process.env.NEXT_SUPABASE_ANON_KEY || '';

const supabase = createClient<Database>(NEXT_SUPABASE_URL, NEXT_SUPABASE_ANON_KEY);

export default supabase;
