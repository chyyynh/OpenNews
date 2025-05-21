"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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

  // Fetch all tags from API
  useEffect(() => {
    let isMounted = true;

    async function fetchTags() {
      try {
        const res = await fetch("/api/user/tags");
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data: { tags: string[] } = await res.json();

        if (isMounted) {
          const uniqueTags = [...new Set(data.tags.filter(Boolean))];
          setTags(uniqueTags.sort());
        }
      } catch (err) {
        console.error("fetchTags 中出錯:", err);
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

  // Fetch user preferences from API
  useEffect(() => {
    if (!user) return;

    async function fetchUserSelectedTags() {
      try {
        if (!user) return;
        const res = await fetch(`/api/user/tags?telegram_id=${user.id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data: { selected_tags?: string[] } = await res.json();

        if (data.selected_tags) {
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

  // Save user tag preferences via API
  const saveUserPreferences = async () => {
    if (!user) {
      return { success: false, message: "無法獲取用戶信息" };
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegram_id: user.id,
          selected_tags: selectedTags,
        }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.message || "保存偏好失敗");

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
