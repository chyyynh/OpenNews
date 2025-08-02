"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const SOURCE_CATEGORIES = {
  "AI Firm": [
    "OpenAI",
    "Google Deepmind",
    "Google Research",
    "Anthropic Research",
  ],
  News: ["CNBC", "Techcrunch"],
  Papers: ["arXiv cs.LG", "arXiv cs.AI", "ACM TiiS"],
  Community: [
    "Huggingface",
    "Hacker News AI",
    "Hacker News Show HN",
    "Product Hunt - AI",
  ],
  Application: ["Browser Company", "Perplexity"],
};

export function useSources() {
  const { data: session } = useSession();

  const searchParams = useSearchParams();

  // Define all sources at the top to avoid inconsistency
  const ALL_SOURCES = [
    "OpenAI",
    "Anthropic Research",
    "Google Deepmind",
    "Google Research",
    "CNBC",
    "Techcrunch",
    "arXiv cs.LG",
    "arXiv cs.AI",
    "ACM TiiS",
    "Huggingface",
    "Hacker News AI",
    "Hacker News Show HN",
    "Product Hunt - AI",
    "Browser Company",
    "Perplexity",
  ];

  const [sources] = useState<string[]>(ALL_SOURCES);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get selected sources from URL
  const getSelectedSources = useCallback(() => {
    const sourcesParam = searchParams.get("sources") || "";
    return sourcesParam ? sourcesParam.split(",") : [];
  }, [searchParams]);

  // Update selectedSources when searchParams change
  useEffect(() => {
    setSelectedSources(getSelectedSources());
  }, [getSelectedSources]);

  // Initialize loading state
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Fetch user preferences from API
  useEffect(() => {
    if (!session?.user?.id) return;

    async function fetchUserSelectedSources() {
      try {
        if (!session?.user?.id) return;
        const res = await fetch(`/api/user/sources?user_id=${session.user.id}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data: { selected_sources?: string[] } = await res.json();

        if (data.selected_sources) {
          setSelectedSources(data.selected_sources);
        }
      } catch (err) {
        console.error("fetchUserSelectedSources 發生錯誤:", err);
      }
    }

    fetchUserSelectedSources();
  }, [session?.user?.id]);

  // Helper function to toggle sources
  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  // Helper function to toggle all sources in a category
  const toggleCategoryAll = (category: string) => {
    const categoryItems = SOURCE_CATEGORIES[category as keyof typeof SOURCE_CATEGORIES] || [];
    const allSelected = categoryItems.every((source) => selectedSources.includes(source));
    
    setSelectedSources((prev) => {
      if (allSelected) {
        // Remove all category items
        return prev.filter((source) => !categoryItems.includes(source));
      } else {
        // Add all category items (avoid duplicates)
        const newSources = [...prev];
        categoryItems.forEach((source) => {
          if (!newSources.includes(source)) {
            newSources.push(source);
          }
        });
        return newSources;
      }
    });
  };

  // Helper function to check if all sources in a category are selected
  const isCategoryAllSelected = (category: string) => {
    const categoryItems = SOURCE_CATEGORIES[category as keyof typeof SOURCE_CATEGORIES] || [];
    return categoryItems.length > 0 && categoryItems.every((source) => selectedSources.includes(source));
  };

  // Save user source preferences via API
  const saveUserSourcePreferences = async () => {
    if (!session?.user?.id) {
      return { success: false, message: "無法獲取用戶信息" };
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/user/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: session.user.id,
          selected_sources: selectedSources,
        }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.message || "保存偏好失敗");

      return { success: true, message: "新聞來源偏好已成功保存" };
    } catch (err) {
      console.error("保存新聞來源偏好出錯:", err);
      return { success: false, message: "保存偏好時發生錯誤" };
    } finally {
      setIsSaving(false);
    }
  };

  // Categorize sources
  const categorizedSources = useMemo(() => {
    const categorized: { [key: string]: string[] } = {};
    const uncategorized: string[] = [];

    sources.forEach((source) => {
      let found = false;
      for (const [category, categoryItems] of Object.entries(
        SOURCE_CATEGORIES
      )) {
        if (categoryItems.includes(source)) {
          if (!categorized[category]) {
            categorized[category] = [];
          }
          categorized[category].push(source);
          found = true;
          break;
        }
      }
      if (!found) {
        uncategorized.push(source);
      }
    });

    // Add uncategorized sources if any
    if (uncategorized.length > 0) {
      categorized["Others"] = uncategorized;
    }

    return categorized;
  }, [sources]);

  return {
    sources,
    selectedSources,
    categorizedSources,
    isLoading,
    isSaving,
    toggleSource,
    toggleCategoryAll,
    isCategoryAllSelected,
    saveUserSourcePreferences,
  };
}
