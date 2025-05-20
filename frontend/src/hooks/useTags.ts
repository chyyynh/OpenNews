"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { TelegramUser } from "@/types";

export function useTags(user: TelegramUser | null) {
  const searchParams = useSearchParams();
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Get selected tags from URL
  const getSelectedTags = useCallback(() => {
    const tagsParam = searchParams.get("tags") || "";
    return tagsParam ? tagsParam.split(",") : [];
  }, [searchParams]);

  // Update selectedTags when searchParams change
  useEffect(() => {
    setSelectedTags(getSelectedTags());
  }, [getSelectedTags]);

  // Fetch tags on component mount
  useEffect(() => {
    let isMounted = true;

    async function fetchTags() {
      try {
        const { data, error } = await supabase
          .from("articles")
          .select("tags")
          .order("scraped_date", { ascending: false })
          .limit(1000);

        if (error) {
          console.error("获取标签时出错:", error);
          return;
        }

        if (isMounted) {
          const allTags = data
            ? data.flatMap((item: { tags: string[] | null }) => item.tags || [])
            : [];
          const uniqueTags = [...new Set(allTags.filter(Boolean))];
          setTags(uniqueTags.sort());
        }
      } catch (err) {
        console.error("fetchTags 中出错:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTags();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch user preferences when user changes
  useEffect(() => {
    if (!user) return;

    async function fetchUserSelectedTags() {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("selected_tags")
          .eq("telegram_id", user?.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("讀取用戶偏好標籤失敗:", error);
          return;
        }

        if (data?.selected_tags) {
          setSelectedTags(data.selected_tags);
        }
      } catch (err) {
        console.error("fetchUserSelectedTags 發生錯誤:", err);
      }
    }

    fetchUserSelectedTags();
  }, [user]);

  // Helper function to toggle tags
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Save user tag preferences
  const saveUserPreferences = async () => {
    if (!user) {
      return { success: false, message: "無法獲取用戶信息" };
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          telegram_id: user.id,
          selected_tags: selectedTags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) throw error;

      return { success: true, message: "標籤偏好已成功保存" };
    } catch (err) {
      console.error("保存標籤偏好出錯:", err);
      return { success: false, message: "保存偏好時發生錯誤" };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    tags,
    selectedTags,
    isLoading,
    isSaving,
    toggleTag,
    saveUserPreferences,
  };
}
