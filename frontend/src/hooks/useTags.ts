"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export function useTags() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  // Define all tags at the top to avoid loading state
  const ALL_TAGS = [
    // AI相關
    "AI",
    "MachineLearning",
    "DeepLearning",
    "NLP",
    "ComputerVision",
    // 科技公司
    "Google",
    "Apple",
    "Microsoft",
    "Meta",
    "OpenAI",
    "Anthropic",
    // 產業
    "Tech",
    "Finance",
    "Healthcare",
    "Education",
    "Gaming",
    // 事件類型
    "Funding",
    "IPO",
    "Acquisition",
    "ProductLaunch",
    "Research",
    // 產品/硬體
    "Robot",
    "Robotics",
    "Hardware",
    "VR",
    "AR",
    "Metaverse",
    "IoT",
    "Smartphone",
    "Chip",
    "Semiconductor",
    // 分類
    "Business",
    "Other",
  ];

  const [tags] = useState<string[]>(ALL_TAGS);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Combined effect to handle both URL params and user preferences
  useEffect(() => {
    // Priority: URL params > User preferences
    const tagsParam = searchParams.get("tags");
    
    if (tagsParam) {
      // If URL has tags param, use it
      const urlTags = tagsParam.split(",").filter(Boolean);
      setSelectedTags(urlTags);
    } else if (session?.user?.id) {
      // If no URL params but user is logged in, fetch user preferences
      async function fetchUserSelectedTags() {
        try {
          const res = await fetch(`/api/user/tags?user_id=${session?.user?.id}`);
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
    } else {
      // No URL params and no user, reset to empty
      setSelectedTags([]);
    }
  }, [searchParams, session?.user?.id]);

  // Helper function to toggle tags
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Save user tag preferences via API
  const saveUserPreferences = async () => {
    if (!session?.user?.id) {
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
          user_id: session.user.id,
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
