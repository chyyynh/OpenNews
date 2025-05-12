"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function RefreshOnNewArticle() {
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel("realtime:articles")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "articles",
        },
        (payload) => {
          console.log("🔁 New article inserted:", payload);
          // 方法 1：使用 router.refresh() 如果你用的是 Next.js App Router
          router.refresh();

          // 方法 2（備選）：整頁刷新
          // window.location.reload()
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null; // 不渲染任何東西
}
