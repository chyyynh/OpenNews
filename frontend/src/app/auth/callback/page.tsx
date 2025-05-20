// app/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/"); // 登入成功，導回首頁或 dashboard
      } else {
        // Magic link 還沒處理完，就等 supabase.auth.onAuthStateChange 來抓
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            router.push("/");
          }
        });
      }
    });
  }, []);

  return <p className="p-4">登入中...</p>;
}
