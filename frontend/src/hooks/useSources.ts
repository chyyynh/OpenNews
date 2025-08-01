"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export function useSources() {
  const { data: session } = useSession();

  const searchParams = useSearchParams();
  const [sources, setSources] = useState<string[]>([
    "OpenAI",
    "CNBC",
    "arXiv cs.LG",
    "arXiv cs.AI",
    "Google Deepmind",
  ]);
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

  // Set hardcoded available sources
  useEffect(() => {
    const hardcodedSources = [
      "OpenAI",
      "Anthropic",
      "Google Deepmind",
      "CNBC",
      "Techcrunch",
      "arXiv cs.LG",
      "arXiv cs.AI",
      "Hacker News AI",
      "Hacker News Show HN",
    ];

    setSources(hardcodedSources);
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

  return {
    sources,
    selectedSources,
    isLoading,
    isSaving,
    toggleSource,
    saveUserSourcePreferences,
  };
}
