"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Loader, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { supabase } from "@/lib/supabase";
import type { ArticleItem, TelegramUser } from "@/types";

import { useTelegramUser } from "@/hooks/useTelegramUser";
import { useTags } from "@/hooks/useTags";
import { useSources } from "@/hooks/useSources";
import { useCustomPrompt } from "@/hooks/useCustomPrompt";
import { UserDisplay } from "@/components/UserDisplay";
import { PromptEditor } from "@/components/PromptEditor";
import { TagSelector } from "@/components/TagSelector";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { SendToTwitterButton } from "@/components/SendToTwitterButton";

// Telegram bot name - replace with your bot name
const TELEGRAM_BOT_NAME = "openews_bot";

export default function Home() {
  // Article state
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [fetchError, setFetchError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Time filter state
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string>("7day");

  // For web version (not Mini App), we need to handle user state manually
  const [webUser, setWebUser] = useState<TelegramUser | null>(null);

  // Get user from localStorage on mount (for web version)
  useEffect(() => {
    const savedUser = localStorage.getItem("telegramUser");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Check if auth is expired (24 hours)
        const authDate = parsedUser.auth_date * 1000;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (now - authDate < oneDay) {
          setWebUser(parsedUser);
        } else {
          localStorage.removeItem("telegramUser");
        }
      } catch (e) {
        console.error("解析保存的用户信息时出错:", e);
        localStorage.removeItem("telegramUser");
      }
    }
  }, []);

  // Use the Telegram user hook (will return null on web version)
  const { user: telegramUser } = useTelegramUser();

  // Combine both user sources - prefer Telegram WebApp user if available
  const user = telegramUser || webUser;

  // Use custom hooks
  const {
    tags,
    selectedTags,
    isLoading: isTagsLoading,
    isSaving: isSavingTags,
    toggleTag,
    saveUserPreferences,
  } = useTags(user);

  const {
    sources,
    selectedSources,
    isLoading: isSourcesLoading,
    isSaving: isSavingSources,
    toggleSource,
    saveUserSourcePreferences,
  } = useSources(user);

  const {
    customPrompt,
    tempCustomPrompt,
    setTempCustomPrompt,
    isSaving: isSavingPrompt,
    saveSuccess,
    handleSavePrompt,
  } = useCustomPrompt(user);

  const searchParams = useSearchParams();

  // Time filter options
  const timeFilterOptions = [
    { value: "today", label: "Today" },
    { value: "7day", label: "7 Days" },
    { value: "1month", label: "1 Month" },
    { value: "3month", label: "3 Months" },
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
            "id, title, url, published_date, tags, keywords, summary, source"
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
              "id, title, url, published_date, tags, keywords, summary, source"
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

  // Fetch articles when selectedTags, selectedSources, or selectedTimeFilter change
  useEffect(() => {
    // Add a small delay to avoid rapid consecutive requests
    const timeoutId = setTimeout(() => {
      fetchArticles(0, true);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fetchArticles]);

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

  // Handle Telegram login (web version)
  const handleTelegramAuth = async (telegramUser: TelegramUser) => {
    try {
      console.log("Telegram auth data received:", telegramUser);

      // 發送到 API 進行驗證
      const response = await fetch("/api/auth/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(telegramUser),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Telegram auth failed:", error);
        toast.error("登入驗證失敗: " + (error.error || "Unknown error"));
        return;
      }

      const result = await response.json();
      console.log("Telegram auth successful:", result);

      // 驗證成功後存儲資料
      localStorage.setItem("telegramUser", JSON.stringify(telegramUser));
      setWebUser(telegramUser);
      toast.success("登入成功");
    } catch (error) {
      console.error("Telegram auth error:", error);
      toast.error("登入過程中發生錯誤");
    }
  };

  // Handle logout (web version)
  const handleLogout = () => {
    setIsAuthLoading(true);
    try {
      localStorage.removeItem("telegramUser");
      setWebUser(null);
      toast.success("已成功登出");
    } catch (error) {
      console.error("登出错误:", error);
      toast.error("登出失败，请重试");
    } finally {
      setIsAuthLoading(false);
    }
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

        {/* Telegram login button/user menu (web version) */}
        {!telegramUser &&
          (user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <UserDisplay user={user} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-sm text-gray-500" disabled>
                  Telegram ID: {user.id}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={isAuthLoading}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="telegram-login-container">
              <TelegramLoginButton
                botName={TELEGRAM_BOT_NAME}
                onAuth={handleTelegramAuth}
                buttonSize="large"
                cornerRadius={8}
                usePic={true}
                lang="zh-hant"
              />
            </div>
          ))}

        {/* If using Telegram WebApp, just show the user */}
        {telegramUser && <UserDisplay user={telegramUser} />}
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

          {/* Sources Filter by Category */}
          {(() => {
            // Helper function to get logo path for source
            const getSourceLogo = (source: string): string | null => {
              const logoMap: Record<string, string> = {
                OpenAI: "/logo/openai.svg",
                "Google Deepmind": "/logo/deepmind-color.svg",
                Anthropic: "/logo/anthropic.svg",
                CNBC: "/logo/cnbc.png",
                Techcrunch: "/logo/techcrunch.png",
                "arXiv cs.LG": "/logo/arxiv.png",
                "arXiv cs.AI": "/logo/arxiv.png",
                "Hacker News AI": "/logo/hackernews.png",
                "Hacker News Show HN": "/logo/hackernews.png",
                "Product Hunt - AI": "/logo/producthunt.jpeg",
                "Browser Company": "/logo/dia.png",
                "Perplexity": "/logo/perplexity.png",
                // Add normalized variations
                openai: "/logo/openai.svg",
                "google deepmind": "/logo/deepmind-color.svg",
                anthropic: "/logo/anthropic.svg",
                cnbc: "/logo/cnbc.png",
                techcrunch: "/logo/techcrunch.png",
                "arxiv cs.lg": "/logo/arxiv.png",
                "arxiv cs.ai": "/logo/arxiv.png",
                "hacker news ai": "/logo/hackernews.png",
                "hacker news show hn": "/logo/hackernews.png",
                "product hunt - ai": "/logo/producthunt.jpeg",
                "browser company": "/logo/dia.png",
                "perplexity": "/logo/perplexity.png",
              };

              // Try exact match first, then lowercase match
              return logoMap[source] || logoMap[source.toLowerCase()] || null;
            };

            // Categorize sources
            const sourceCategories = {
              "AI Firm": ["OpenAI", "Google Deepmind", "Anthropic"],
              News: ["CNBC", "Techcrunch"],
              Papers: ["arXiv cs.LG", "arXiv cs.AI"],
              Community: ["Hacker News AI", "Hacker News Show HN", "Product Hunt - AI"],
              Application: ["Browser Company", "Perplexity"],
            };

            // Group sources by category
            const categorizedSources: { [key: string]: string[] } = {};
            const uncategorizedSources: string[] = [];

            sources.forEach((source) => {
              let categorized = false;
              for (const [category, categoryItems] of Object.entries(
                sourceCategories
              )) {
                if (categoryItems.includes(source)) {
                  if (!categorizedSources[category]) {
                    categorizedSources[category] = [];
                  }
                  categorizedSources[category].push(source);
                  categorized = true;
                  break;
                }
              }
              if (!categorized) {
                uncategorizedSources.push(source);
              }
            });

            // Add uncategorized sources if any
            if (uncategorizedSources.length > 0) {
              categorizedSources["Others"] = uncategorizedSources;
            }

            const renderSourceItem = (source: string) => {
              const logoPath = getSourceLogo(source);
              return (
                <DropdownMenuCheckboxItem
                  key={source}
                  checked={selectedSources.includes(source)}
                  onCheckedChange={() => toggleSource && toggleSource(source)}
                  className="flex items-center gap-2"
                >
                  {logoPath && (
                    <img
                      src={logoPath}
                      alt={`${source} logo`}
                      className="w-4 h-4 object-contain"
                      onError={(e) => {
                        // Hide image if it fails to load
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span>{source}</span>
                </DropdownMenuCheckboxItem>
              );
            };

            return Object.entries(categorizedSources).map(
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
                      {categoryItems.map(renderSourceItem)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
            );
          })()}
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
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    <h2 className="text-xl font-semibold mb-1">{item.title}</h2>
                  </a>
                  {/* Show summary if it exists, limit to 3 lines */}
                  {item.summary && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                      {item.summary}
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
                    articleSummary={item.summary}
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
