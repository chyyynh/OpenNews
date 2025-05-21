"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { TelegramUser } from "@/types";

export function useCustomPrompt(user: TelegramUser | null) {
  const [customPrompt, setCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");
  const [tempCustomPrompt, setTempCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch user custom prompt when user changes
  // TODO: edit to /api/edit-custom-prompt
  useEffect(() => {
    if (!user) return;

    async function fetchUserCustomPrompt() {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("custom_prompt")
          .eq("telegram_id", user?.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("讀取用戶自定義提示詞失敗:", error);
          return;
        }

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

  // Save custom prompt
  const handleSavePrompt = useCallback(async () => {
    if (!user) {
      return { success: false, message: "請先登入以保存提示詞" };
    }

    if (tempCustomPrompt === customPrompt) {
      return { success: false, message: "提示内容未更改" };
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          telegram_id: user.id,
          custom_prompt: tempCustomPrompt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) throw error;

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
