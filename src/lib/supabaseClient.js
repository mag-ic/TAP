import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safely check and use fallback values if environment variables are not loaded (e.g. during static build)
// This prevents the application from crashing at import time, allowing the mock-data fallback UI to render.
const isValidUrl = supabaseUrl && supabaseUrl.startsWith('http');
const safeUrl = isValidUrl ? supabaseUrl : 'https://xtefjwkbtaldtfwwzngc.supabase.co';
const safeKey = supabaseAnonKey && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' ? supabaseAnonKey : 'placeholder-key';

export const supabase = createClient(safeUrl, safeKey);
