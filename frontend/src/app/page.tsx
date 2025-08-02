"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Loader, ChevronDown } from "lucide-react";
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

  // Use Better Auth session
  const { data: session } = useSession();

  // Convert Better Auth user to AppUser format
  const user: AppUser | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image || undefined,
      }
    : null;

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

  // Time filter options
  const timeFilterOptions = [
    { value: "today", label: "Today" },
    { value: "7day", label: "7 Days" },
    { value: "1month", label: "1 Month" },
    { value: "3month", label: "3 Months" },
    { value: "all", label: "All Time" },
  ];

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
            "id, title, url, published_date, tags, keywords, summary, content, source"
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
              "id, title, url, published_date, tags, keywords, summary, content, source"
            )
            .order("published_date", { ascending: false });

          if (selectedTags.length > 0) {
            query = query.overlaps("tags", selectedTags);
          }

          if (selectedSources.length > 0) {
            query = query.in("source", selectedSources);
          }

          const dateFilter = getDateFilter(selectedTimeFilter);
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
    selectedTags,
    selectedSources,
    selectedTimeFilter,
  ]);

  // Initial fetch on mount and when dependencies change
  useEffect(() => {
    const loadArticles = async () => {
      setIsLoading(true);
      setHasMore(true);

      try {
        let query = supabase
          .from("articles")
          .select(
            "id, title, url, published_date, tags, keywords, summary, content, source"
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
      } catch (err) {
        console.error("loadArticles 中出错:", err);
        setFetchError(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadArticles();
  }, [selectedTags, selectedSources, selectedTimeFilter]);

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
          <h1 className="text-3xl font-bold text-center sm:text-left">
            OpenNews Demo: AI News/Content Collection
          </h1>
          <h3 className="mb-2 flex justify-between items-center">
            {selectedTags.length > 0 ? `${selectedTags.join(", ")}` : ""}
          </h3>
        </div>

        {/* Authentication */}
        {session?.user ? (
          <UserMenu user={session.user} />
        ) : (
          <div className="flex gap-2">
            <Link href="/login">
              <Button variant="outline">登入</Button>
            </Link>
            <Link href="/signup">
              <Button>註冊</Button>
            </Link>
          </div>
        )}
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
                    {categoryItems.map((source) => (
                      <DropdownMenuCheckboxItem
                        key={source}
                        checked={selectedSources.includes(source)}
                        onCheckedChange={() => toggleSource && toggleSource(source)}
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
          {isLoading && <p>正在載入文章...</p>}

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
                    <h2 className="text-xl font-semibold mb-1">{item.title}</h2>
                  </a>
                  {/* Show summary if it exists, otherwise show content, limit to 3 lines */}
                  {(item.summary || item.content) && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                      {item.summary || item.content}
                    </p>
                  )}
                  <div className="text-sm text-gray-500 mt-2">
                    <span>
                      {new Date(item.published_date).toLocaleDateString()}
                    </span>
                    {item.tags && item.tags.length > 0 && (
                      <span className="ml-2">
                        | 標籤: {item.tags.join(", ")}
                      </span>
                    )}
                    {item.keywords && item.keywords.length > 0 && (
                      <span className="ml-2">
                        | 關鍵字: {item.keywords.join(", ")}
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
                    <span>載入更多文章...</span>
                  </div>
                </li>
              )}

              {/* No more data indicator */}
              {!hasMore && articles.length > 0 && (
                <li className="flex justify-center py-4">
                  <span className="text-gray-500">已載入所有文章</span>
                </li>
              )}
            </ul>
          ) : (
            // Show message if no articles found and no error
            !isLoading &&
            !fetchError && (
              <p>
                未找到文章
                {selectedTags.length > 0
                  ? ` 標籤: "${selectedTags.join(", ")}"`
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
