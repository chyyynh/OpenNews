"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Loader, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { supabase } from "@/lib/supabase";
import type { ArticleItem, TelegramUser } from "@/types";

import { useTelegramUser } from "@/hooks/useTelegramUser";
import { useTags } from "@/hooks/useTags";
import { useCustomPrompt } from "@/hooks/useCustomPrompt";
import { UserDisplay } from "@/components/UserDisplay";
import { PromptEditor } from "@/components/PromptEditor";
import { TagSelector } from "@/components/TagSelector";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { SendToTwitterButton } from "@/components/SendToTwitterButton";

// Telegram bot name - replace with your bot name
const TELEGRAM_BOT_NAME = "OpenNews_bot";

export default function Home() {
  // Article state
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [fetchError, setFetchError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

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
    customPrompt,
    tempCustomPrompt,
    setTempCustomPrompt,
    isSaving: isSavingPrompt,
    saveSuccess,
    handleSavePrompt,
  } = useCustomPrompt(user);

  const searchParams = useSearchParams();

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

  // Fetch articles when selectedTags change
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchArticles() {
      if (!isMounted) return;

      setIsLoading(true);
      try {
        let query = supabase
          .from("articles")
          .select("id, title, url, published_date, tags, summary")
          .order("published_date", { ascending: false });

        if (selectedTags.length > 0) {
          query = query.overlaps("tags", selectedTags);
        }

        query = query.limit(20);

        const { data, error } = await query;

        if (!isMounted) return;

        if (error) {
          console.error("获取文章时出错:", error);
          setFetchError(error);
          return;
        }

        setArticles(data as ArticleItem[]);
        setFetchError(null);
      } catch (err) {
        if (!isMounted) return;
        console.error("fetchArticles 中出错:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    // Add a small delay to avoid rapid consecutive requests
    const timeoutId = setTimeout(() => {
      fetchArticles();
    }, 100);

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [selectedTags]);

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

  // Handle Telegram login (web version)
  const handleTelegramAuth = (telegramUser: TelegramUser) => {
    localStorage.setItem("telegramUser", JSON.stringify(telegramUser));
    setWebUser(telegramUser);
    toast.success("登入成功");
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
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-center sm:text-left">
          Latest News{" "}
          {selectedTags.length > 0 ? ` - 標籤: ${selectedTags.join(", ")}` : ""}
        </h1>

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
                buttonSize="medium"
                cornerRadius={8}
                usePic={true}
                lang="zh-hant"
              />
            </div>
          ))}

        {/* If using Telegram WebApp, just show the user */}
        {telegramUser && <UserDisplay user={telegramUser} />}
      </header>

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

        {/* Tags Selector */}
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
                      發布日期:{" "}
                      {new Date(item.published_date).toLocaleDateString()}
                    </span>
                    {item.tags && item.tags.length > 0 && (
                      <span className="ml-2">
                        | 標籤: {item.tags.join(", ")}
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

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">更改追蹤標籤</h2>
            <Button
              onClick={handleSavePreferencesWithToast}
              disabled={isSavingTags || !user}
            >
              {isSavingTags ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                "儲存新聞偏好"
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* "All tags" button to clear selection */}
            <Link href="/" passHref>
              <Button
                variant={selectedTags.length === 0 ? "default" : "outline"}
                size="sm"
                className="rounded-full"
              >
                所有標籤
              </Button>
            </Link>
            {/* Tag buttons to toggle selection */}
            {tags.map((tag) => (
              <Link href={getToggleTagHref(tag)} key={tag} passHref>
                <Button
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                >
                  {tag}
                </Button>
              </Link>
            ))}
            {tags.length === 0 && !fetchError && (
              <p className="text-sm text-gray-500">未找到標籤。</p>
            )}
          </div>
        </aside>
      </div>

      <footer className="mt-12 text-center text-gray-500 text-sm">
        由 Next.js 和 Supabase 提供支持
      </footer>
    </div>
  );
}
