// lib/startSupabaseListener.ts
import { createClient } from "@supabase/supabase-js";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 確保只訂閱一次
let hasSubscribed = false;

export function startSupabaseListener(router: AppRouterInstance) {
  if (hasSubscribed) return;

  hasSubscribed = true;

  supabase
    .channel("realtime:articles")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "articles",
      },
      (payload) => {
        console.log("🆕 New article received from Supabase:", payload);
        router.refresh(); // 可改成 window.location.reload() 視需求
      }
    )
    .subscribe();

  console.log("✅ Supabase listener started");
}
