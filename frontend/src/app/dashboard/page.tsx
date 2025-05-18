"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// 主題列表
const topics = [
  { id: "all", name: "所有標籤" },
  { id: "ada", name: "ADA" },
  { id: "avax", name: "AVAX" },
  { id: "bnb", name: "BNB" },
  { id: "btc", name: "BTC" },
  { id: "doge", name: "DOGE" },
  { id: "eth", name: "ETH" },
  { id: "link", name: "LINK" },
  { id: "ltc", name: "LTC" },
  { id: "matic", name: "MATIC" },
  { id: "sol", name: "SOL" },
  { id: "xrp", name: "XRP" },
  { id: "defi", name: "defi" },
  { id: "funding", name: "funding" },
  { id: "hack", name: "hack" },
  { id: "listing", name: "listing" },
  { id: "nft", name: "nft" },
  { id: "partnership", name: "partnership" },
  { id: "regulation", name: "regulation" },
  { id: "stablecoin", name: "stablecoin" },
  { id: "trump", name: "trump" },
];

export default function DashboardPage() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // 切換主題選擇
  const toggleTopic = (topicId: string) => {
    if (topicId === "all") {
      // 如果選擇"所有標籤"，則清除其他選擇
      setSelectedTopics(["all"]);
      return;
    }

    // 如果已選擇"所有標籤"，則清除它
    const newSelection = selectedTopics.filter((id) => id !== "all");

    // 切換當前主題
    if (newSelection.includes(topicId)) {
      setSelectedTopics(newSelection.filter((id) => id !== topicId));
    } else {
      setSelectedTopics([...newSelection, topicId]);
    }
  };

  // 保存選擇到 Supabase
  const saveTopicPreferences = async () => {
    try {
      setIsSaving(true);

      // 獲取當前用戶
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.message("請先登入", {
          description: "您需要登入才能保存主題偏好",
        });
        return;
      }

      // 保存到 Supabase
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          topics: selectedTopics,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) throw error;

      toast.message("已保存", {
        description: "您的主題偏好已成功保存",
      });

      // 刷新頁面數據
      router.refresh();
    } catch (error) {
      console.error("保存失敗:", error);
      toast.message("保存失敗", {
        description: "無法保存您的主題偏好，請稍後再試",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 從 Supabase 加載用戶偏好
  const loadUserPreferences = async () => {
    try {
      // 獲取當前用戶
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // 從 Supabase 獲取用戶偏好
      const { data, error } = await supabase
        .from("user_preferences")
        .select("topics")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data && data.topics) {
        setSelectedTopics(data.topics);
      }
    } catch (error) {
      console.error("加載偏好失敗:", error);
    }
  };

  // 當組件掛載時加載用戶偏好
  useState(() => {
    loadUserPreferences();
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4 sm:px-6">
          <h1 className="text-xl font-bold">加密貨幣新聞中心</h1>
          <div className="ml-auto flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜尋新聞..."
                className="w-[200px] pl-8 md:w-[260px] lg:w-[320px]"
              />
            </div>
            <Button variant="outline" size="sm">
              登入
            </Button>
            <Button size="sm">註冊</Button>
          </div>
        </div>
      </header>
      <main className="container px-4 py-6 sm:px-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">選擇您感興趣的主題</h2>
            <Button
              onClick={saveTopicPreferences}
              disabled={isSaving || selectedTopics.length === 0}
            >
              {isSaving ? "保存中..." : "保存偏好"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <Button
                key={topic.id}
                variant={
                  selectedTopics.includes(topic.id) ? "default" : "outline"
                }
                className={`rounded-full ${
                  topic.id === "all"
                    ? selectedTopics.includes("all")
                      ? "bg-black text-white"
                      : ""
                    : ""
                }`}
                onClick={() => toggleTopic(topic.id)}
              >
                {topic.name}
              </Button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
