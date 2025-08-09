"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Converter } from "opencc-js";
import { SourceIcon } from "@/components/SourceIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { ArticleItem, AppUser } from "@/types";
import { useTags } from "@/hooks/useTags";
import { useSources } from "@/hooks/useSources";
import { useCustomPrompt } from "@/hooks/useCustomPrompt";
import { CollapsiblePromptEditor } from "@/components/CollapsiblePromptEditor";
import { CollapsibleTagSelector } from "@/components/CollapsibleTagSelector";
import { PromptEditor } from "@/components/PromptEditor";
import { RequestRSSDialog } from "@/components/RequestRSSDialog";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import { KOLModeToggle } from "@/components/KOLModeToggle";
import { UserMenu } from "@/components/UserMenu";
import { SendToTwitterButton } from "@/components/SendToTwitterButton";
import { useSession } from "@/lib/auth-client";

export default function Home() {
  // Article state
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [fetchError, setFetchError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Time filter state
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>("7day");

  // Language state
  const [selectedLanguage, setSelectedLanguage] = useState<string>("zh-TW");

  // KOL Mode state
  const [isKolModeEnabled, setIsKolModeEnabled] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Article selection state (changed to support multiple articles)
  const [selectedArticles, setSelectedArticles] = useState<ArticleItem[]>([]);

  // Test result state
  const [testResult, setTestResult] = useState<{
    prompt: string;
    article: {
      title: string;
      summary?: string;
      content?: string;
    };
    response: string;
    isLoading?: boolean;
    error?: string;
  } | null>(null);

  // Initialize converters
  const converterToSimplified = Converter({ from: "tw", to: "cn" });

  // Use Better Auth session
  const { data: session } = useSession();

  // Convert Better Auth user to AppUser format (memoized to prevent re-creation)
  const user: AppUser | null = useMemo(() => {
    if (!session?.user) return null;

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image || undefined,
    };
  }, [session?.user]);

  // Use custom hooks
  const {
    tags,
    selectedTags,
    isSaving: isSavingTags,
    toggleTag,
    saveUserPreferences,
  } = useTags();

  const {
    selectedSources,
    categorizedSources,
    toggleSource,
    toggleCategoryAll,
    isCategoryAllSelected,
  } = useSources();

  const {
    customPrompt,
    tempCustomPrompt,
    setTempCustomPrompt,
    isSaving: isSavingPrompt,
    saveSuccess,
    handleSavePrompt,
  } = useCustomPrompt();

  // Stable reference for current filter values (moved up to avoid hoisting issues)
  const currentFilters = useMemo(
    () => ({
      tags: selectedTags,
      sources: selectedSources,
      timeFilter: selectedTimeFilter,
    }),
    [selectedTags, selectedSources, selectedTimeFilter]
  );

  // Time filter options
  const timeFilterOptions = [
    { value: "today", label: "Today" },
    { value: "7day", label: "7 Days" },
    { value: "1month", label: "1 Month" },
    { value: "3month", label: "3 Months" },
    { value: "all", label: "All Time" },
  ];

  // Language options
  const languageOptions = [
    { value: "en", label: "English" },
    { value: "zh-TW", label: "繁體中文" },
    { value: "zh-CN", label: "简体中文" },
  ];

  // Convert text based on selected language (only for Chinese text)
  const convertText = useCallback(
    (text: string) => {
      // Only convert if switching to simplified Chinese
      if (selectedLanguage === "zh-CN") {
        return converterToSimplified(text);
      }
      // For English and Traditional Chinese, return original text
      return text;
    },
    [selectedLanguage, converterToSimplified]
  );

  // Get article title based on selected language
  const getArticleTitle = useCallback(
    (item: ArticleItem) => {
      if (selectedLanguage === "en") {
        return item.title; // English title
      } else if (selectedLanguage === "zh-CN") {
        return convertText(item.title_cn || item.title);
      } else {
        return item.title_cn || item.title; // Traditional Chinese
      }
    },
    [selectedLanguage, convertText]
  );

  // Get article summary based on selected language
  const getArticleSummary = useCallback(
    (item: ArticleItem) => {
      if (selectedLanguage === "en") {
        return item.summary || "";
      } else if (selectedLanguage === "zh-CN") {
        return convertText(item.summary_cn || item.summary || "");
      } else {
        return item.summary_cn || item.summary || "";
      }
    },
    [selectedLanguage, convertText]
  );

  // Get date filter based on selected time filter
  const getDateFilter = (timeFilter: string) => {
    const now = new Date();
    switch (timeFilter) {
      case "today":
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        return today.toISOString();
      case "7day":
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return sevenDaysAgo.toISOString();
      case "1month":
        const oneMonthAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          now.getDate()
        );
        return oneMonthAgo.toISOString();
      case "3month":
        const threeMonthsAgo = new Date(
          now.getFullYear(),
          now.getMonth() - 3,
          now.getDate()
        );
        return threeMonthsAgo.toISOString();
      case "all":
        return null;
      default:
        return null;
    }
  };

  // Infinite scroll effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (
          !isLoadingMore &&
          hasMore &&
          articles.length > 0 &&
          window.innerHeight + document.documentElement.scrollTop >=
            document.documentElement.offsetHeight - 1000
        ) {
          setIsLoadingMore(true);

          // Build query
          let query = supabase
            .from("articles")
            .select(
              "id, title, title_cn, url, published_date, tags, keywords, summary, summary_cn, content, source"
            )
            .order("published_date", { ascending: false });

          if (currentFilters.tags.length > 0) {
            query = query.overlaps("tags", currentFilters.tags);
          }

          if (currentFilters.sources.length > 0) {
            query = query.in("source", currentFilters.sources);
          }

          const dateFilter = getDateFilter(currentFilters.timeFilter);
          if (dateFilter) {
            query = query.gte("published_date", dateFilter);
          }

          query = query.range(articles.length, articles.length + 19);

          query.then(({ data, error }) => {
            if (error) {
              console.error("加載更多文章時出錯:", error);
              setFetchError(error);
            } else {
              const newArticles = data as ArticleItem[];
              // Filter out duplicate articles by ID
              setArticles((prev) => {
                const existingIds = new Set(prev.map((article) => article.id));
                const uniqueNewArticles = newArticles.filter(
                  (article) => !existingIds.has(article.id)
                );
                return [...prev, ...uniqueNewArticles];
              });
              setHasMore(newArticles.length === 20);
              setFetchError(null);
            }
            setIsLoadingMore(false);
          });
        }
      }, 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [isLoadingMore, hasMore, articles.length, currentFilters]);

  // Track previous filters to prevent unnecessary reloads
  const [previousFilters, setPreviousFilters] = useState(currentFilters);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Initial fetch on mount and when dependencies change
  useEffect(() => {
    // Skip if filters haven't actually changed (prevents login-triggered reload)
    const filtersChanged =
      JSON.stringify(previousFilters) !== JSON.stringify(currentFilters);

    if (!hasInitialLoad || filtersChanged) {
      const loadArticles = async () => {
        // Only show loading on initial load or actual filter changes
        if (!hasInitialLoad) {
          setIsLoading(true);
        }
        setHasMore(true);

        try {
          let query = supabase
            .from("articles")
            .select(
              "id, title, title_cn, url, published_date, tags, keywords, summary, summary_cn, content, source"
            )
            .order("published_date", { ascending: false });

          if (currentFilters.tags.length > 0) {
            query = query.overlaps("tags", currentFilters.tags);
          }

          if (currentFilters.sources.length > 0) {
            query = query.in("source", currentFilters.sources);
          }

          // Add time filter
          const dateFilter = getDateFilter(currentFilters.timeFilter);
          if (dateFilter) {
            query = query.gte("published_date", dateFilter);
          }

          query = query.range(0, 19); // Load 20 items at a time

          const { data, error } = await query;

          if (error) {
            console.error("获取文章时出错:", error);
            setFetchError(error);
            return;
          }

          const newArticles = data as ArticleItem[];
          setArticles(newArticles);
          setHasMore(newArticles.length === 20);
          setFetchError(null);
          setPreviousFilters(currentFilters);
          setHasInitialLoad(true);
        } catch (err) {
          console.error("loadArticles 中出错:", err);
          setFetchError(err);
        } finally {
          setIsLoading(false);
        }
      };

      loadArticles();
    }
  }, [currentFilters, previousFilters, hasInitialLoad]);

  // Handle saving prompt with toast notifications
  const handleSavePromptWithToast = async () => {
    const result = await handleSavePrompt();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast(result.message, { duration: 2000 });
    }
    return result;
  };

  // Handle saving preferences with toast notifications
  const handleSavePreferencesWithToast = async () => {
    const result = await saveUserPreferences();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  // Handle clear test result
  const handleClearTestResult = () => {
    setTestResult(null);
  };

  // Handle deselect article
  const handleDeselectArticle = (articleId: number) => {
    setSelectedArticles((prev) =>
      prev.filter((article) => article.id !== articleId)
    );
    // Clear test result when selection changes
    if (testResult) {
      setTestResult(null);
    }
  };

  // Handle test prompt (updated to support multiple articles)
  const handleTestPrompt = async (articles: ArticleItem[], prompt: string) => {
    // Set initial loading state
    const initialResult = {
      prompt,
      article:
        articles.length > 0
          ? {
              title:
                articles.length === 1
                  ? getArticleTitle(articles[0])
                  : `${articles.length} 篇文章`,
              summary: undefined,
              content: undefined,
            }
          : { title: "", summary: undefined, content: undefined },
      response: "",
      isLoading: true,
    };

    setTestResult(initialResult);

    try {
      // Call API to test prompt with multiple articles
      const response = await fetch("/api/test-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articles: articles.map((article) => ({
            title: article.title,
            summary: article.summary,
            content: article.content,
            url: article.url,
          })),
          prompt: prompt.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const apiError =
          errorData.error || `HTTP error! status: ${response.status}`;
        throw new Error(apiError);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let pendingChunk = "";

      if (!reader) {
        throw new Error("Unable to read streaming response");
      }

      // Start streaming
      console.log("Starting to read streaming response...");
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("Stream completed");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        pendingChunk += chunk;
        const lines = pendingChunk.split("\n");

        // Keep the last incomplete line for next iteration
        pendingChunk = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6);
            if (jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                // Character-by-character streaming for better visual effect
                for (let i = 0; i < content.length; i++) {
                  fullResponse += content[i];

                  setTestResult({
                    ...initialResult,
                    response: fullResponse,
                    isLoading: false,
                  });

                  // Adjust delay for typing effect (smaller = faster)
                  await new Promise((resolve) => setTimeout(resolve, 10));
                }
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
              console.warn("Failed to parse chunk:", jsonStr);
            }
          }
        }
      }

      if (fullResponse) {
        toast.success("Prompt 測試完成");
      } else {
        throw new Error("No response content received");
      }
    } catch (error) {
      console.error("Test prompt error:", error);

      let errorMessage = "發生未知錯誤";
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      setTestResult({
        ...initialResult,
        error: errorMessage,
        isLoading: false,
      });

      // Show appropriate toast message based on error type
      if (
        errorMessage.includes("過載") ||
        errorMessage.includes("overloaded")
      ) {
        toast.error("AI 模型目前過載，請稍後再試", { duration: 5000 });
      } else if (
        errorMessage.includes("頻繁") ||
        errorMessage.includes("rate limit")
      ) {
        toast.error("請求過於頻繁，請稍後再試", { duration: 4000 });
      } else {
        toast.error("測試失敗，請稍後再試", { duration: 3000 });
      }
    }
  };

  return (
    <div className="h-screen flex flex-col font-[family-name:var(--font-geist-sans)] px-3 pt-4 sm:px-8 sm:pt-8">
      <div className="container mx-auto flex flex-col h-full">
        <header className="flex-shrink-0 mb-2">
          {/* Top Row - Title and Authentication */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold mb-1">
                {convertText("OpenNews Demo: AI Content Collection")}
              </h1>
              <a
                href="https://github.com/chyyynh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              >
                built by chyyynh
              </a>
            </div>

            {/* Top Right - Language Selector, KOL Mode, and Authentication */}
            <div className="flex items-center gap-2 ml-4">
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 text-sm"
                  >
                    {
                      languageOptions.find(
                        (lang) => lang.value === selectedLanguage
                      )?.label
                    }
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup
                    value={selectedLanguage}
                    onValueChange={setSelectedLanguage}
                  >
                    {languageOptions.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* KOL Mode Toggle - Only show for logged in users */}
              {session?.user && (
                <KOLModeToggle
                  isEnabled={isKolModeEnabled}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => {
                    if (!isKolModeEnabled) {
                      setIsKolModeEnabled(true);
                    } else {
                      // Just toggle sidebar collapse/expand when KOL Mode is enabled
                      setIsSidebarCollapsed(!isSidebarCollapsed);
                    }
                  }}
                />
              )}

              {/* Authentication (Desktop Only) */}
              {session?.user ? (
                <UserMenu
                  user={session.user}
                  isKolModeEnabled={isKolModeEnabled}
                  onKolModeToggle={setIsKolModeEnabled}
                />
              ) : (
                <div className="hidden sm:flex gap-2">
                  <Link href="/login">
                    <Button variant="outline" size="sm" className="text-sm">
                      {convertText("登入")}
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button size="sm" className="text-sm">
                      {convertText("註冊")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row - Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="text-sm text-gray-600 mt-2">
              {selectedTags.join(", ")}
            </div>
          )}
        </header>

        {/* Mobile: Collapsible prompt editor and tags */}
        <div className="md:hidden flex-shrink-0 mb-6 space-y-3">
          <CollapsiblePromptEditor
            user={user}
            tempCustomPrompt={tempCustomPrompt}
            setTempCustomPrompt={setTempCustomPrompt}
            isSaving={isSavingPrompt}
            saveSuccess={saveSuccess}
            handleSavePrompt={handleSavePromptWithToast}
            customPrompt={customPrompt}
          />

          <CollapsibleTagSelector
            user={user}
            tags={tags}
            selectedTags={selectedTags}
            toggleTag={toggleTag}
            isSaving={isSavingTags}
            saveUserPreferences={handleSavePreferencesWithToast}
          />
        </div>

        {/* Main content area - Flexible */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Article list - Scrollable */}
          <main
            className={`transition-all duration-500 ease-in-out ${
              isKolModeEnabled && !isSidebarCollapsed
                ? "flex-[3] pr-8"
                : "flex-1 pr-8"
            }`}
          >
            {/* Filters - Sticky inside article area */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 pb-4 mb-4 border-b border-gray-200">
              {/* Mobile: All filters */}
              <div className="flex sm:hidden gap-2 items-center overflow-x-auto pb-2 scrollbar-hide">
                {/* Time Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-xs whitespace-nowrap flex-shrink-0"
                    >
                      {
                        timeFilterOptions.find(
                          (option) => option.value === selectedTimeFilter
                        )?.label
                      }
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuRadioGroup
                      value={selectedTimeFilter}
                      onValueChange={setSelectedTimeFilter}
                    >
                      {timeFilterOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-300 flex-shrink-0"></div>

                {Object.entries(categorizedSources).map(
                  ([category, categoryItems]) => {
                    const selectedInCategory = categoryItems.filter((item) =>
                      selectedSources.includes(item)
                    );

                    return (
                      <DropdownMenu key={category}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-xs whitespace-nowrap flex-shrink-0"
                          >
                            {selectedInCategory.length === 0
                              ? category
                              : selectedInCategory.length === 1
                              ? selectedInCategory[0]
                              : `${category} (${selectedInCategory.length})`}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                          <DropdownMenuCheckboxItem
                            checked={isCategoryAllSelected(category)}
                            onCheckedChange={() => toggleCategoryAll(category)}
                            className="font-medium border-b border-gray-200 mb-1 pb-1"
                          >
                            All {category}
                          </DropdownMenuCheckboxItem>
                          {categoryItems.map((source) => (
                            <DropdownMenuCheckboxItem
                              key={source}
                              checked={selectedSources.includes(source)}
                              onCheckedChange={() =>
                                toggleSource && toggleSource(source)
                              }
                              className="flex items-center gap-2"
                            >
                              <SourceIcon source={source} />
                              <span>{source}</span>
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  }
                )}

                {/* RSS Request Button */}
                <RequestRSSDialog className="ml-2" />
              </div>

              {/* Desktop: All filters */}
              <div className="hidden sm:flex flex-wrap gap-2 items-center">
                {/* Time Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 text-sm"
                    >
                      {
                        timeFilterOptions.find(
                          (option) => option.value === selectedTimeFilter
                        )?.label
                      }
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuRadioGroup
                      value={selectedTimeFilter}
                      onValueChange={setSelectedTimeFilter}
                    >
                      {timeFilterOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Separator */}
                <div className="w-px h-6 bg-gray-300 mx-2"></div>

                {Object.entries(categorizedSources).map(
                  ([category, categoryItems]) => {
                    const selectedInCategory = categoryItems.filter((item) =>
                      selectedSources.includes(item)
                    );

                    return (
                      <DropdownMenu key={category}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1 text-sm"
                          >
                            {selectedInCategory.length === 0
                              ? category
                              : selectedInCategory.length === 1
                              ? selectedInCategory[0]
                              : `${category} (${selectedInCategory.length})`}
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                          <DropdownMenuCheckboxItem
                            checked={isCategoryAllSelected(category)}
                            onCheckedChange={() => toggleCategoryAll(category)}
                            className="font-medium border-b border-gray-200 mb-1 pb-1"
                          >
                            All {category}
                          </DropdownMenuCheckboxItem>
                          {categoryItems.map((source) => (
                            <DropdownMenuCheckboxItem
                              key={source}
                              checked={selectedSources.includes(source)}
                              onCheckedChange={() =>
                                toggleSource && toggleSource(source)
                              }
                              className="flex items-center gap-2"
                            >
                              <SourceIcon source={source} />
                              <span>{source}</span>
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  }
                )}

                {/* RSS Request Button */}
                <RequestRSSDialog className="ml-2" />
              </div>
            </div>

            {/* Scrollable article list */}
            <div className="overflow-y-auto h-full">
              {isLoading && <p>{convertText("正在載入文章...")}</p>}

              {/* Show error if fetchError exists */}
              {fetchError && (
                <p className="text-red-500">
                  無法獲取文章。錯誤: {fetchError.message || "未知错误"}
                </p>
              )}

              {/* Show articles if no error and articles exist */}
              {!isLoading && !fetchError && articles && articles.length > 0 ? (
                <ul className="space-y-4">
                  {articles.map((item: ArticleItem) => (
                    <li
                      key={item.id}
                      className={`border rounded-lg p-3 sm:p-4 shadow hover:shadow-md transition-all duration-200 overflow-auto cursor-pointer ${
                        selectedArticles.some(
                          (selected) => selected.id === item.id
                        )
                          ? "border-blue-500 bg-blue-50"
                          : "hover:border-gray-400"
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        const isSelected = selectedArticles.some(
                          (selected) => selected.id === item.id
                        );

                        if (isSelected) {
                          // Remove from selection
                          setSelectedArticles((prev) =>
                            prev.filter((selected) => selected.id !== item.id)
                          );
                        } else {
                          // Add to selection
                          setSelectedArticles((prev) => [...prev, item]);
                        }

                        // Clear test result when selection changes
                        if (testResult) {
                          setTestResult(null);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <SourceIcon source={item.source} className="w-4 h-4" />
                        <span className="text-sm text-gray-500">
                          {item.source}
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        <h2 className="text-lg sm:text-xl font-semibold mb-1">
                          {getArticleTitle(item)}
                        </h2>
                      </a>
                      {/* Show summary if it exists, otherwise show content, limit to 3 lines */}
                      {(getArticleSummary(item) || item.content) && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                          {getArticleSummary(item) || item.content || ""}
                        </p>
                      )}
                      <div className="text-sm text-gray-500 mt-2">
                        <span>
                          {new Date(item.published_date).toLocaleDateString()}
                        </span>
                        {item.tags && item.tags.length > 0 && (
                          <span className="ml-2">
                            | {convertText("標籤")}: {item.tags.join(", ")}
                          </span>
                        )}
                        {item.keywords && item.keywords.length > 0 && (
                          <span className="ml-2">
                            | {convertText("關鍵字")}:{" "}
                            {item.keywords.join(", ")}
                          </span>
                        )}
                      </div>
                      <SendToTwitterButton
                        articleTitle={item.title}
                        articleUrl={item.url}
                        articleSummary={item.summary || item.content}
                        customPrompt={customPrompt}
                      />
                    </li>
                  ))}

                  {/* Loading more indicator */}
                  {isLoadingMore && (
                    <li className="flex justify-center py-4">
                      <div className="flex items-center gap-2">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span>{convertText("載入更多文章...")}</span>
                      </div>
                    </li>
                  )}

                  {/* No more data indicator */}
                  {!hasMore && articles.length > 0 && (
                    <li className="flex justify-center py-4">
                      <span className="text-gray-500">
                        {convertText("已載入所有文章")}
                      </span>
                    </li>
                  )}
                </ul>
              ) : (
                // Show message if no articles found and no error
                !isLoading &&
                !fetchError && (
                  <p>
                    {convertText("未找到文章")}
                    {selectedTags.length > 0
                      ? ` ${convertText("標籤")}: "${selectedTags.join(", ")}"`
                      : ""}
                    .
                  </p>
                )
              )}
            </div>
          </main>

          {/* KOL Mode Collapsible Sidebar */}
          {true && (
            <div
              className={`relative transition-all duration-500 ease-in-out ${
                !isKolModeEnabled
                  ? "w-px border-l border-gray-300 bg-gray-100"
                  : isSidebarCollapsed
                  ? "w-px border-l border-gray-300 bg-gray-100"
                  : "flex-[2]"
              }`}
            >
              {/* Sidebar Collapse/Expand Button - Fixed position */}
              <div className="absolute top-1/2 left-0 z-50 -translate-x-1/2 -translate-y-1/2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!isKolModeEnabled) {
                      setIsKolModeEnabled(true);
                      setIsSidebarCollapsed(false); // Ensure it expands when opening
                    } else {
                      setIsSidebarCollapsed(!isSidebarCollapsed);
                    }
                  }}
                  className="p-2 h-8 w-8 transition-all duration-300 ease-in-out hover:bg-gray-100 rounded-full border-2 border-gray-200 bg-white"
                  title={
                    !isKolModeEnabled
                      ? "開啟 Dashboard"
                      : isSidebarCollapsed
                      ? "展開 Dashboard"
                      : "收縮 Dashboard"
                  }
                >
                  {!isKolModeEnabled ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : isSidebarCollapsed ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Dashboard Content - Only show when KOL Mode is enabled */}
              {isKolModeEnabled && (
                <CollapsibleSidebar
                  user={user}
                  tempCustomPrompt={tempCustomPrompt}
                  setTempCustomPrompt={setTempCustomPrompt}
                  isSavingPrompt={isSavingPrompt}
                  saveSuccess={saveSuccess}
                  handleSavePrompt={handleSavePromptWithToast}
                  customPrompt={customPrompt}
                  tags={tags}
                  selectedTags={selectedTags}
                  toggleTag={toggleTag}
                  isSavingTags={isSavingTags}
                  saveUserPreferences={handleSavePreferencesWithToast}
                  isCollapsed={isSidebarCollapsed}
                  selectedArticles={selectedArticles}
                  onTestPrompt={handleTestPrompt}
                  onDeselectArticle={handleDeselectArticle}
                  testResult={testResult}
                  onClearTestResult={handleClearTestResult}
                  getArticleTitle={getArticleTitle}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
