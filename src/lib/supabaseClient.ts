import { Database } from '@/types/database.types';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_SUPABASE_ANON_KEY || '';

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
