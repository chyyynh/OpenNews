"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader, Check, UserIcon } from "lucide-react";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Add this after the existing interfaces
interface TelegramWebApp {
  version: string;
  platform: string;
  colorScheme: "light" | "dark";
  themeParams: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
    secondary_bg_color?: string;
  };
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      photo_url?: string;
    };
    auth_date: number;
    hash: string;
  };
  initData: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
}

// Add this to the global Window interface
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
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

export default function MiniApp() {
  const searchParams = useSearchParams();

  // Telegram user state
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Prompt state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [customPrompt, setCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");
  const [tempCustomPrompt, setTempCustomPrompt] =
    useState<string>("請用孫子兵法的語氣");

  // Tags state
  const [tags, setTags] = useState<string[]>([]);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  // Get selected tags from URL
  const getSelectedTags = useCallback(() => {
    const tagsParam = searchParams.get("tags") || "";
    return tagsParam ? tagsParam.split(",") : [];
  }, [searchParams]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Update selectedTags when searchParams change
  useEffect(() => {
    setSelectedTags(getSelectedTags());
  }, [getSelectedTags]);

  // Fetch tags on component mount
  useEffect(() => {
    let isMounted = true;

    async function fetchTags() {
      try {
        const { data, error } = await supabase
          .from("articles")
          .select("tags")
          .order("scraped_date", { ascending: false })
          .limit(1000);

        if (error) {
          console.error("[Supabase] fetchTags Error", error);
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
        console.error("fetchTags Error:", err);
      }
    }

    fetchTags();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch user preferences when user changes
  useEffect(() => {
    if (!user) return;

    async function fetchUserSelectedTags() {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("selected_tags, custom_prompt")
          .eq("telegram_id", user?.id)
          .single();

        if (error && error.code !== "PGRST116") {
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

  // Helper function to toggle tags
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Save custom prompt
  const handleSavePrompt = useCallback(async () => {
    if (!user) {
      toast.error("請先登入以保存提示詞");
      return;
    }

    if (tempCustomPrompt === customPrompt) {
      toast("提示内容未更改", {
        duration: 2000,
      });
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          telegram_id: user.id,
          custom_prompt: tempCustomPrompt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) throw error;

      setCustomPrompt(tempCustomPrompt);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      toast.success("自訂 Prompt 已更新");
    } catch (err) {
      console.error("保存自訂 Prompt 出錯:", err);
      toast.error("保存自訂 Prompt 時發生錯誤");
    } finally {
      setIsSaving(false);
    }
  }, [tempCustomPrompt, customPrompt, user]);

  const saveUserPreferences = async () => {
    if (!user) {
      toast.error("無法獲取用戶信息");
      return;
    }

    setIsSavingPreferences(true);

    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          telegram_id: user.id,
          selected_tags: selectedTags,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      );

      if (error) throw error;

      toast.success("標籤偏好已成功保存");
    } catch (err) {
      console.error("保存標籤偏好出錯:", err);
      toast.error("保存偏好時發生錯誤");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Parse Telegram WebApp data
  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;

      // Log initialization
      console.log("Telegram WebApp initialized", {
        version: webApp.version,
        platform: webApp.platform,
        colorScheme: webApp.colorScheme,
        themeParams: webApp.themeParams,
      });

      // Signal to Telegram that the Mini App is ready
      webApp.ready();

      // Get user info
      if (webApp.initDataUnsafe?.user) {
        const tgUser = webApp.initDataUnsafe.user;
        setUser({
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
          auth_date: Math.floor(Date.now() / 1000),
          hash: "from_webapp",
        });

        console.log("User data loaded from Telegram WebApp", tgUser);
      } else {
        console.warn("No user data available in WebApp.initDataUnsafe");

        // For development outside of Telegram
        if (process.env.NODE_ENV === "development") {
          console.log("Setting mock user for development");
          setUser({
            id: 12345,
            first_name: "Dev",
            last_name: "User",
            username: "devuser",
            auth_date: Math.floor(Date.now() / 1000),
            hash: "dev_mode",
          });
        }
      }

      // Apply Telegram theme colors
      if (webApp.themeParams) {
        document.documentElement.style.setProperty(
          "--tg-theme-bg-color",
          webApp.themeParams.bg_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-text-color",
          webApp.themeParams.text_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-hint-color",
          webApp.themeParams.hint_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-link-color",
          webApp.themeParams.link_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-button-color",
          webApp.themeParams.button_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-button-text-color",
          webApp.themeParams.button_text_color || ""
        );
      }
    } else {
      console.warn(
        "Telegram WebApp is not available. Are you running outside of Telegram?"
      );

      // For development outside of Telegram
      if (process.env.NODE_ENV === "development") {
        console.log("Setting mock user for development");
        setUser({
          id: 12345,
          first_name: "Dev",
          last_name: "User",
          username: "devuser",
          auth_date: Math.floor(Date.now() / 1000),
          hash: "dev_mode",
        });
      }
    }
  }, []);

  return (
    <div
      className="container mx-auto p-4 sm:p-6 font-[family-name:var(--font-geist-sans)]"
      style={{
        backgroundColor: "var(--tg-theme-bg-color)",
        color: "var(--tg-theme-text-color)",
      }}
    >
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Telegram Mini App</h1>

        {user && (
          <div className="flex items-center gap-2">
            {user.photo_url ? (
              <img
                src={user.photo_url || "/placeholder.svg"}
                alt={user.first_name}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <UserIcon className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">
              {user.username ||
                `${user.first_name}${
                  user.last_name ? ` ${user.last_name}` : ""
                }`}
            </span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prompt Editor */}
        <div className="border rounded-lg p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">自訂提示詞</h2>
          <div className="grid w-full gap-3">
            <Textarea
              placeholder="載入自定義提示詞..."
              value={tempCustomPrompt}
              onChange={(e) => setTempCustomPrompt(e.target.value)}
              className="min-h-[120px]"
            />
            <Button
              onClick={handleSavePrompt}
              disabled={isSaving || tempCustomPrompt === customPrompt || !user}
              className="relative tg-button"
              style={{
                backgroundColor: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              {isSaving ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
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
        </div>

        {/* Tags Selector */}
        <div className="border rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">選擇標籤</h2>
            <Button
              onClick={saveUserPreferences}
              disabled={isSavingPreferences || !user}
              size="sm"
              className="tg-button"
              style={{
                backgroundColor: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              {isSavingPreferences ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : (
                "儲存標籤偏好"
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-1">
            {tags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                style={
                  selectedTags.includes(tag)
                    ? {
                        backgroundColor: "var(--tg-theme-button-color)",
                        color: "var(--tg-theme-button-text-color)",
                      }
                    : {
                        borderColor: "var(--tg-theme-button-color)",
                        color: "var(--tg-theme-button-color)",
                      }
                }
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Button>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-gray-500">未找到標籤。</p>
            )}
          </div>

          {selectedTags.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">已選擇的標籤:</h3>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <div
                    key={tag}
                    className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center"
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-8 text-center text-gray-500 text-sm">
        由 Next.js 和 Supabase 提供支持
      </footer>
    </div>
  );
}
