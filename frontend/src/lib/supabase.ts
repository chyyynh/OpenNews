// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// 從環境變數中獲取 Supabase URL 和 anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
