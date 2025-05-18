"use client";

import {
  createClient,
  type PostgrestError,
  type User,
} from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader, Check } from "lucide-react";

import { SendToTwitterButton } from "@/components/SendToTwitterButton";

interface ArticleItem {
  id: number;
  title: string;
  url: string;
  published_date: string;
  tags: string[];
  summary: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL 或 Anon Key 缺失。请确保它们在您的环境变量中设置。"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 页面组件
export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 移除 useToast 钩子
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

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

  // 获取标签 - 只在组件挂载时执行一次
  useEffect(() => {
    let isMounted = true; // 防止组件卸载后设置状态

    async function fetchTags() {
      try {
        const { data, error } = await supabase
          .from("articles")
          .select("tags")
          .limit(2000);

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

    return () => {
      isMounted = false; // 组件卸载时清理
    };
  }, []); // 空依赖数组，只在挂载时执行一次

  // 获取文章 - 添加防抖，避免频繁请求
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

  // 认证效果 - 保持不变
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoadingAuth(false);
        /* 注释掉登录重定向
      if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
        router.push("/login")
      }
      */
      }
    );

    // 检查初始会话
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoadingAuth(false);
      /* 注释掉登录重定向
      if (!session) {
        router.push("/login")
      }
      */
    };
    checkSession();

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, [router]);

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
  const handleSavePrompt = useCallback(() => {
    if (tempCustomPrompt === customPrompt) {
      // using sonner's toast
      toast("提示内容未更改", {
        duration: 2000,
      });
      return;
    }

    setIsSaving(true);

    // 模拟保存过程
    setTimeout(() => {
      setCustomPrompt(tempCustomPrompt);
      setIsSaving(false);
      setSaveSuccess(true);

      // 使用 sonner 的 toast
      toast.success("自定義 Prompt 已更新，所有文章將使用新的 Prompt");

      // 重置成功状态
      setTimeout(() => {
        setSaveSuccess(false);
      }, 1500);
    }, 600);
  }, [tempCustomPrompt, customPrompt]);

  return (
    <div className="container mx-auto p-4 sm:p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-center sm:text-left">
          Latest News{" "}
          {selectedTags.length > 0 ? ` - 標籤: ${selectedTags.join(", ")}` : ""}
        </h1>
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
        <aside className="md:col-span-1 border-l md:pl-6">
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
            <Button>儲存新聞偏好</Button>
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
