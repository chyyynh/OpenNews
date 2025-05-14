"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TelegramLogin() {
  const router = useRouter();

  useEffect(() => {
    // 渲染 Telegram 登入按鈕
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "OpenNews_bot"); // 不含 @
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.async = true;
    document.getElementById("telegram-login-button")?.appendChild(script);

    // 定義 Telegram callback
    (window as any).onTelegramAuth = async (user: any) => {
      const res = await fetch("/api/auth/telegram/verify", {
        method: "POST",
        body: JSON.stringify(user),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorText = await res.text(); // 處理錯誤回應
        console.error("伺服器錯誤：", errorText);
        return alert("伺服器錯誤，請稍後再試。");
      }

      const data = await res.json(); // 解析回應資料

      if (!data.token) {
        // 檢查是否有 token
        console.error("登入失敗，無效的登入資料", data);
        return alert("登入失敗，無效的登入資料。");
      }

      // 登入 Supabase
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "telegram",
        token: data.token, // 使用從 API 取得的 token
      });

      if (error) {
        console.error("Supabase login error", error.message);
        alert("登入 Supabase 失敗");
      } else {
        router.push("/"); // ✅ 登入後導向你要的頁面
      }
    };
  }, []);

  return <div id="telegram-login-button"></div>;
}
