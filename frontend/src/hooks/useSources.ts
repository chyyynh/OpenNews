"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { TelegramUser } from "@/types";

export function useSources(user: TelegramUser | null) {
  console.log('useSources hook called with user:', user?.id);
  
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  console.log('useSources state:', { sourcesLength: sources.length, isLoading });

  // Get selected sources from URL
  const getSelectedSources = useCallback(() => {
    const sourcesParam = searchParams.get("sources") || "";
    return sourcesParam ? sourcesParam.split(",") : [];
  }, [searchParams]);

  // Update selectedSources when searchParams change
  useEffect(() => {
    setSelectedSources(getSelectedSources());
  }, [getSelectedSources]);

  // Fetch all available sources from Supabase
  useEffect(() => {
    async function fetchAvailableSources() {
      console.log('Fetching available sources from database...');
      
      const fallbackSources = [
        "OpenAI",
        "BWENEWS", 
        "CNBC",
        "arXiv cs.LG",
        "arXiv cs.AI",
        "Google Deepmind"
      ];
      
      try {
        const response = await fetch('/api/user/sources/available');
        console.log('Sources API response status:', response.status);
        
        if (!response.ok) {
          console.warn('Sources API failed, using fallback sources');
          setSources(fallbackSources);
          setIsLoading(false);
          return;
        }
        
        const data = await response.json();
        console.log('Sources API response data:', data);
        
        // Use API data if available, otherwise fallback
        const availableSources = data.sources && Array.isArray(data.sources) && data.sources.length > 0 
          ? data.sources 
          : fallbackSources;
        
        if (data.note) {
          console.log('API note:', data.note);
        }
          
        console.log('Final sources list:', availableSources);
        console.log('About to call setSources with:', availableSources);
        setSources(availableSources);
        console.log('setSources called successfully');
        
      } catch (error) {
        console.error('Error fetching sources:', error);
        console.log('Using fallback sources due to error');
        console.log('Fallback sources:', fallbackSources);
        setSources(fallbackSources);
        console.log('Fallback setSources called');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAvailableSources();
  }, []);

  // Fetch user preferences from API
  useEffect(() => {
    if (!user) return;

    async function fetchUserSelectedSources() {
      try {
        if (!user) return;
        const res = await fetch(`/api/user/sources?telegram_id=${user.id}`);
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
  }, [user]);

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
    if (!user) {
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
          telegram_id: user.id,
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