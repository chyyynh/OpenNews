"use client";

import { useState, useEffect, useCallback } from "react";
import { TelegramUser } from "@/types";

export function useCustomPrompt(user: TelegramUser | null) {
  const [customPrompt, setCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");
  const [tempCustomPrompt, setTempCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 用 GET API 讀取 custom_prompt
  useEffect(() => {
    if (!user) return;

    async function fetchUserCustomPrompt() {
      try {
        if (!user) return;
        const res = await fetch(
          `/api/user/customPrompt?telegram_id=${user.id}`
        );
        if (!res.ok) {
          const errData = await res.json();
          console.error("讀取用戶自定義提示詞失敗:", errData.error);
          return;
        }
        const data = await res.json();
        if (data?.custom_prompt) {
          setCustomPrompt(data.custom_prompt);
          setTempCustomPrompt(data.custom_prompt);
        }
      } catch (err) {
        console.error("fetchUserCustomPrompt 發生錯誤:", err);
      }
    }

    fetchUserCustomPrompt();
  }, [user]);

  // 用 POST API 儲存 custom_prompt
  const handleSavePrompt = useCallback(async () => {
    if (!user) {
      return { success: false, message: "請先登入以保存提示詞" };
    }

    if (tempCustomPrompt === customPrompt) {
      return { success: false, message: "提示內容未更改" };
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/customPrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: user.id,
          custom_prompt: tempCustomPrompt,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "伺服器錯誤");
      }

      setCustomPrompt(tempCustomPrompt);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      return { success: true, message: "自訂 Prompt 已更新" };
    } catch (err) {
      console.error("保存自訂 Prompt 出錯:", err);
      return { success: false, message: "保存自訂 Prompt 時發生錯誤" };
    } finally {
      setIsSaving(false);
    }
  }, [tempCustomPrompt, customPrompt, user]);

  return {
    customPrompt,
    tempCustomPrompt,
    setTempCustomPrompt,
    isSaving,
    saveSuccess,
    handleSavePrompt,
  };
}
