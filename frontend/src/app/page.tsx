"use client";

import { createClient, type PostgrestError } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader, Check, LogOut, UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import TelegramLoginButton from "@/components/TelegramLoginButton";

import { SendToTwitterButton } from "@/components/SendToTwitterButton";

interface ArticleItem {
  id: number;
  title: string;
  url: string;
  published_date: string;
  tags: string[];
  summary: string | null;
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL 或 Anon Key 缺失。请确保它们在您的环境变量中设置。"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Telegram bot name - replace with your bot name
const TELEGRAM_BOT_NAME = "OpenNews_bot";

// Page Component
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 使用 Telegram 用户替代 Supabase 用户
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // 添加保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 添加标签和文章的状态
  const [tags, setTags] = useState<string[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [fetchError, setFetchError] = useState<PostgrestError | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customPrompt, setCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");
  const [tempCustomPrompt, setTempCustomPrompt] =
    useState<string>("請用孫子兵法的語氣"); // 临时存储编辑中的提示
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // 从 URL 获取选定的标签 - 使用 useSearchParams，但使用useMemo或useRef来避免不必要的重新计算
  // 使用useCallback来记忆这个值，避免每次渲染都重新计算
  const getSelectedTags = useCallback(() => {
    const tagsParam = searchParams.get("tags") || "";
    return tagsParam ? tagsParam.split(",") : [];
  }, [searchParams]);

  // 存储计算后的selectedTags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 只在searchParams变化时更新selectedTags
  useEffect(() => {
    setSelectedTags(getSelectedTags());
  }, [getSelectedTags]);

  // 讀取新聞標籤 - 只在组件挂载时执行一次
  useEffect(() => {
    let isMounted = true; // 防止组件卸载后设置状态

    async function fetchTags() {
      try {
        const { data, error } = await supabase
          .from("articles")
          .select("tags")
          .order("scraped_date", { ascending: false }) // 依照建立時間由新到舊排序
          .limit(1000);

        if (error) {
          console.error("获取标签时出错:", error);
          return;
        }

        if (isMounted) {
          const allTags = data
            ? data.flatMap((item: { tags: string[] | null }) => item.tags || [])
            : [];
          const uniqueTags = [...new Set(allTags.filter(Boolean))];
          setTags(uniqueTags.sort());
        }
      } catch (err) {
        console.error("fetchTags 中出错:", err);
      }
    }

    fetchTags();

    // 检查本地存储中是否有保存的用户信息
    const savedUser = localStorage.getItem("telegramUser");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // 检查认证是否过期（24小时）
        const authDate = parsedUser.auth_date * 1000; // 转换为毫秒
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000; // 24小时（毫秒）

        if (now - authDate < oneDay) {
          setUser(parsedUser);
        } else {
          // 认证已过期，清除本地存储
          localStorage.removeItem("telegramUser");
        }
      } catch (e) {
        console.error("解析保存的用户信息时出错:", e);
        localStorage.removeItem("telegramUser");
      }
    }

    return () => {
      isMounted = false; // 组件卸载时清理
    };
  }, []); // 空依赖数组，只在挂载时执行一次

  // 獲取文章 - 添加防抖，避免频繁请求
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController(); // 用于取消请求

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

    // 使用setTimeout添加一点延迟，避免快速连续请求
    const timeoutId = setTimeout(() => {
      fetchArticles();
    }, 100);

    return () => {
      isMounted = false;
      controller.abort(); // 取消未完成的请求
      clearTimeout(timeoutId); // 清除定时器
    };
  }, [selectedTags]); // 只在selectedTags变化时重新获取

  // 讀取用戶選擇的標籤 - 只在用戶變化時執行
  useEffect(() => {
    if (!user) return;

    async function fetchUserSelectedTags() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("selected_tags, custom_prompt")
          .eq("telegram_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 = no rows found，沒有資料是正常狀況
          console.error("讀取用戶偏好標籤失敗:", error);
          return;
        }

        if (data?.selected_tags) {
          setSelectedTags(data.selected_tags);
        }

        if (data?.custom_prompt) {
          setCustomPrompt(data.custom_prompt);
          setTempCustomPrompt(data.custom_prompt);
        }
      } catch (err) {
        console.error("fetchUserSelectedTags 發生錯誤:", err);
      }
    }

    fetchUserSelectedTags();
  }, [user]);

  // 生成标签切换的 href 的辅助函数 - 使用useCallback记忆函数
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

  // 处理保存提示的函数
  const handleSavePrompt = useCallback(async () => {
    if (tempCustomPrompt === customPrompt) {
      // using sonner's toast
      toast("提示内容未更改", {
        duration: 2000,
      });
      return;
    }

    setIsSaving(true);

    try {
      // 更新 Supabase
      const { error } = await supabase.from("user_preferences").upsert(
        {
          telegram_id: user?.id,
          custom_prompt: tempCustomPrompt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) throw error;

      setCustomPrompt(tempCustomPrompt);
      toast.success("自訂 Prompt 已更新，所有文章將使用新的 Prompt");
    } catch (err) {
      console.error("保存自訂 Prompt 出錯:", err);
      toast.error("保存自訂 Prompt 時發生錯誤");
    } finally {
      setIsSaving(false);
    }
  }, [tempCustomPrompt, customPrompt]);

  // 保存用户标签偏好到本地存储
  const saveUserPreferences = async () => {
    if (!user) {
      toast.error("請先登入以保存偏好設置");
      return;
    }

    setIsSavingPreferences(true);

    try {
      // 保存到本地存储
      localStorage.setItem(
        `tagPreferences_${user.id}`,
        JSON.stringify(selectedTags)
      );

      const { data, error } = await supabase.from("user_preferences").upsert(
        {
          telegram_id: user.id,
          selected_tags: selectedTags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" } // 根據 telegram_id 決定是 insert 或 update
      );

      if (error) throw error;

      toast.success("新聞偏好已成功保存");
    } catch (err) {
      console.error("保存新聞偏好出錯:", err);
      toast.error("保存偏好時發生錯誤");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // 处理 Telegram 登录
  const handleTelegramAuth = (telegramUser: TelegramUser) => {
    // 保存用户信息到本地存储
    localStorage.setItem("telegramUser", JSON.stringify(telegramUser));
    setUser(telegramUser);
    toast.success("登入成功");
  };

  // 处理登出
  const handleLogout = () => {
    setIsAuthLoading(true);
    try {
      // 清除本地存储中的用户信息
      localStorage.removeItem("telegramUser");
      setUser(null);
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

        {/* Telegram 登录按钮/用户菜单 */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                {user.photo_url ? (
                  <img
                    src={user.photo_url || "/placeholder.svg"}
                    alt={user.first_name}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <UserIcon className="h-4 w-4" />
                )}
                {user.username ||
                  `${user.first_name}${
                    user.last_name ? ` ${user.last_name}` : ""
                  }`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-sm text-gray-500" disabled>
                Telegram ID: {user.id}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={isAuthLoading}>
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
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 左列（文章列表） */}
        <main className="md:col-span-2 flex flex-col gap-4">
          {isLoading && <p>正在載入文章...</p>}

          {/* 如果发生 fetchError，显示错误 */}
          {fetchError && (
            <p className="text-red-500">
              無法獲取文章。錯誤: {fetchError.message || "未知错误"}
            </p>
          )}

          {/* 如果没有错误且文章存在，显示文章 */}
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
                  {/* 如果存在摘要，显示摘要，限制为3行 */}
                  {item.summary && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                      {item.summary}
                    </p>
                  )}
                  <div className="text-sm text-gray-500 mt-2">
                    <span>
                      發布日期:
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
            // 如果没有找到文章且没有错误，显示消息
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

        {/* 右列（标签过滤器） */}
        <aside className="md:col-span-1 border-l md:pl-6 md:sticky md:top-8 md:self-start md:max-h-screen md:overflow-y-auto">
          <div className="grid w-full gap-2 mb-4">
            <Textarea
              placeholder="載入自定義提示詞..."
              value={tempCustomPrompt}
              onChange={(e) => setTempCustomPrompt(e.target.value)}
            />
            <Button
              onClick={handleSavePrompt}
              disabled={isSaving || tempCustomPrompt === customPrompt}
              className="relative"
            >
              {isSaving ? (
                <>
                  <Loader className="mr-2 h-4 w-4" />
                  正在保存...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  已保存
                </>
              ) : (
                "保存提示詞"
              )}
            </Button>
          </div>
          <hr className="mb-4"></hr>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">更改追蹤標籤</h2>
            <Button
              onClick={saveUserPreferences}
              disabled={isSavingPreferences || !user}
            >
              {isSavingPreferences ? (
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
            {/* "所有标签"按钮清除选择 */}
            <Link href="/" passHref>
              <Button
                variant={selectedTags.length === 0 ? "default" : "outline"}
                size="sm"
                className="rounded-full"
              >
                所有標籤
              </Button>
            </Link>
            {/* 標籤按鈕切換選擇 */}
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
