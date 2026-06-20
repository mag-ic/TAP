import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn(
    'Supabase Anon Key is missing or using placeholder. Please update VITE_SUPABASE_ANON_KEY in your local .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
