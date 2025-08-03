"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Loader, ChevronDown } from "lucide-react";
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
import { PromptEditor } from "@/components/PromptEditor";
import { TagSelector } from "@/components/TagSelector";
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

  // Initialize converters
  const converterToSimplified = Converter({ from: "tw", to: "cn" });
  const converterToTraditional = Converter({ from: "cn", to: "tw" });

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
  }, [session?.user?.id, session?.user?.name, session?.user?.email, session?.user?.image]);

  // Use custom hooks
  const {
    tags,
    selectedTags,
    isLoading: isTagsLoading,
    isSaving: isSavingTags,
    toggleTag,
    saveUserPreferences,
  } = useTags();

  const {
    sources,
    selectedSources,
    categorizedSources,
    isLoading: isSourcesLoading,
    isSaving: isSavingSources,
    toggleSource,
    toggleCategoryAll,
    isCategoryAllSelected,
    saveUserSourcePreferences,
  } = useSources();

  const {
    customPrompt,
    tempCustomPrompt,
    setTempCustomPrompt,
    isSaving: isSavingPrompt,
    saveSuccess,
    handleSavePrompt,
  } = useCustomPrompt();

  const searchParams = useSearchParams();

  // Stable reference for current filter values (moved up to avoid hoisting issues)
  const currentFilters = useMemo(() => ({
    tags: selectedTags,
    sources: selectedSources,
    timeFilter: selectedTimeFilter
  }), [selectedTags, selectedSources, selectedTimeFilter]);

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
  const convertText = useCallback((text: string) => {
    // Only convert if switching to simplified Chinese
    if (selectedLanguage === "zh-CN") {
      return converterToSimplified(text);
    }
    // For English and Traditional Chinese, return original text
    return text;
  }, [selectedLanguage, converterToSimplified]);

  // Get article title based on selected language
  const getArticleTitle = useCallback((item: ArticleItem) => {
    if (selectedLanguage === "en") {
      return item.title; // English title
    } else if (selectedLanguage === "zh-CN") {
      return convertText(item.title_cn || item.title);
    } else {
      return item.title_cn || item.title; // Traditional Chinese
    }
  }, [selectedLanguage, convertText]);

  // Get article summary based on selected language
  const getArticleSummary = useCallback((item: ArticleItem) => {
    if (selectedLanguage === "en") {
      return item.summary || "";
    } else if (selectedLanguage === "zh-CN") {
      return convertText(item.summary_cn || item.summary || "");
    } else {
      return item.summary_cn || item.summary || "";
    }
  }, [selectedLanguage, convertText]);

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

  // Generate tag toggle href
  const getToggleTagHref = useCallback(
    (tag: string): string => {
      const newSelectedTags = selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag];

      if (newSelectedTags.length === 0) {
        return "/";
      }
      return `/?tags=${newSelectedTags.map(encodeURIComponent).join(",")}`;
    },
    [selectedTags]
  );

  // Fetch articles function
  const fetchArticles = useCallback(
    async (offset = 0, reset = false) => {
      if (reset) {
        setIsLoading(true);
        setHasMore(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        let query = supabase
          .from("articles")
          .select(
            "id, title, title_cn, url, published_date, tags, keywords, summary, summary_cn, content, source"
          )
          .order("published_date", { ascending: false });

        if (selectedTags.length > 0) {
          query = query.overlaps("tags", selectedTags);
        }

        if (selectedSources.length > 0) {
          query = query.in("source", selectedSources);
        }

        // Add time filter
        const dateFilter = getDateFilter(selectedTimeFilter);
        if (dateFilter) {
          query = query.gte("published_date", dateFilter);
        }

        query = query.range(offset, offset + 19); // Load 20 items at a time

        const { data, error } = await query;

        if (error) {
          console.error("获取文章时出错:", error);
          setFetchError(error);
          return;
        }

        const newArticles = data as ArticleItem[];

        if (reset) {
          setArticles(newArticles);
        } else {
          // Filter out duplicate articles by ID
          setArticles((prev) => {
            const existingIds = new Set(prev.map((article) => article.id));
            const uniqueNewArticles = newArticles.filter(
              (article) => !existingIds.has(article.id)
            );
            return [...prev, ...uniqueNewArticles];
          });
        }

        // Check if we have more data
        setHasMore(newArticles.length === 20);
        setFetchError(null);
      } catch (err) {
        console.error("fetchArticles 中出错:", err);
        setFetchError(err);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedTags, selectedSources, selectedTimeFilter]
  );

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
  }, [
    isLoadingMore,
    hasMore,
    articles.length,
    currentFilters,
  ]);

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

  // Handle saving source preferences with toast notifications
  const handleSaveSourcePreferencesWithToast = async () => {
    const result = await saveUserSourcePreferences();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    return result;
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="mb-4 flex justify-between items-start">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-center sm:text-left">
              {convertText("OpenNews Demo: AI Content Collection")}
            </h1>
            <a
              href="https://github.com/chyyynh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1 ml-4"
            >
              built by chyyynh
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
          <h3 className="mb-2 flex justify-between items-center">
            {selectedTags.length > 0 ? `${selectedTags.join(", ")}` : ""}
          </h3>
        </div>

        {/* Language Selector and Authentication */}
        <div className="flex items-center gap-4">
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
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

          {/* Authentication */}
          {session?.user ? (
            <UserMenu user={session.user} />
          ) : (
            <div className="flex gap-2">
              <Link href="/login">
                <Button variant="outline">{convertText("登入")}</Button>
              </Link>
              <Link href="/signup">
                <Button>{convertText("註冊")}</Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Time and Sources Filter - appears above news */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Time Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
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
                      className="flex items-center gap-2"
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
        </div>
      </div>

      {/* Mobile: Prompt editor and tags at the top */}
      <div className="md:hidden mb-6 space-y-4">
        <PromptEditor
          user={user}
          tempCustomPrompt={tempCustomPrompt}
          setTempCustomPrompt={setTempCustomPrompt}
          isSaving={isSavingPrompt}
          saveSuccess={saveSuccess}
          handleSavePrompt={handleSavePromptWithToast}
          customPrompt={customPrompt}
        />

        {/* Tags and Sources Selector */}
        <TagSelector
          user={user}
          tags={tags}
          selectedTags={selectedTags}
          toggleTag={toggleTag}
          isSaving={isSavingTags}
          saveUserPreferences={handleSavePreferencesWithToast}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column (article list) */}
        <main className="md:col-span-2 flex flex-col gap-4">
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
                  className="border rounded-lg p-4 shadow hover:shadow-md transition-shadow overflow-auto"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <SourceIcon source={item.source} className="w-4 h-4" />
                    <span className="text-sm text-gray-500">{item.source}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    <h2 className="text-xl font-semibold mb-1">
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
                        | {convertText("關鍵字")}: {item.keywords.join(", ")}
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
        </main>

        {/* Right column (tag filter and prompt editor) - desktop only */}
        <aside className="hidden md:block md:col-span-1 border-l md:pl-6 md:sticky md:top-8 md:self-start md:max-h-screen md:overflow-y-auto">
          <div className="mb-4">
            <PromptEditor
              user={user}
              tempCustomPrompt={tempCustomPrompt}
              setTempCustomPrompt={setTempCustomPrompt}
              isSaving={isSavingPrompt}
              saveSuccess={saveSuccess}
              handleSavePrompt={handleSavePromptWithToast}
              customPrompt={customPrompt}
            />
          </div>
          <hr className="mb-4"></hr>

          {/* Tags and Sources Selector */}
          <TagSelector
            user={user}
            tags={tags}
            selectedTags={selectedTags}
            toggleTag={toggleTag}
            isSaving={isSavingTags}
            saveUserPreferences={handleSavePreferencesWithToast}
          />
        </aside>
      </div>
    </div>
  );
}
