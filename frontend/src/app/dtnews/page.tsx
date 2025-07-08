"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Eye, Heart, Repeat2 } from "lucide-react";

interface Tweet {
  id: number;
  tweet_id: string;
  text: string;
  created_at: string;
  scraped_at: string;
  author_id: string;
  author_username: string;
  author_name: string;
  author_verified: boolean;
  view_count: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
  tweet_url: string;
  media_urls: string[];
  list_type: string;
  list_id: string;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  lang: string;
  possibly_sensitive: boolean;
  source: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL 或 Anon Key 缺失。请确保它们在您的环境变量中设置。"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DTNews() {
  const [allTweets, setAllTweets] = useState<Tweet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedListType, setSelectedListType] = useState<string>("all");
  const [selectedTweets, setSelectedTweets] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTweets();
  }, []);

  const fetchTweets = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("dtnews_tweets")
        .select("*")
        .gt("view_count", 10000)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching tweets:", error);
        toast.error("獲取推文失敗");
        return;
      }

      setAllTweets(data || []);
    } catch (error) {
      console.error("Error:", error);
      toast.error("發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleTweetSelection = (tweetId: string) => {
    const newSelected = new Set(selectedTweets);
    if (newSelected.has(tweetId)) {
      newSelected.delete(tweetId);
    } else {
      newSelected.add(tweetId);
    }
    setSelectedTweets(newSelected);
  };

  const generatePrompt = () => {
    const selectedTweetList = displayTweets.filter((tweet) =>
      selectedTweets.has(tweet.tweet_id)
    );

    if (selectedTweetList.length === 0) {
      toast.error("請至少選擇一條推文");
      return;
    }

    const tweetUrls = selectedTweetList
      .map((tweet) => tweet.tweet_url)
      .join("\n");

    const prompt = `${tweetUrls} 用跟附件文件完全一样的格式（数字标题样式，分割线，链接样式等），根据以上 ${selectedTweetList.length} 个链接的内容，用简体中文生成今天的 ${selectedTweetList.length} 条 ai 日报和日報標題，每条新闻分成两段，每段至少两句话，两段中间隔一行，第一段和标题隔一行，第二段和链接隔一行，链接样式是" 推文：原始链接文本"，每条新闻之间要有分隔线，每条新闻标题大小是普通文本但是加粗！！`;

    // 複製到剪貼板
    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        toast.success("Prompt 已複製到剪貼板！");
      })
      .catch(() => {
        toast.error("複製失败，請手動複製");
        // 顯示 prompt 讓用戶手動複製
        alert(prompt);
      });
  };

  const clearSelection = () => {
    setSelectedTweets(new Set());
  };

  const coreTweets = allTweets.filter((tweet) => tweet.list_type === "Core");
  const applicationTweets = allTweets.filter(
    (tweet) => tweet.list_type === "Application"
  );

  // 根據選擇的類型過濾顯示的推文
  const displayTweets =
    selectedListType === "all"
      ? allTweets
      : selectedListType === "Core"
      ? coreTweets
      : applicationTweets;

  return (
    <div className="container mx-auto p-4 sm:p-6 font-[family-name:var(--font-geist-sans)] text-sm">
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-4">DTNews - 高瀏覽量推文</h1>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedListType("all")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              selectedListType === "all"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            全部 ({allTweets.length})
          </button>
          <button
            onClick={() => setSelectedListType("Core")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              selectedListType === "Core"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Core ({coreTweets.length})
          </button>
          <button
            onClick={() => setSelectedListType("Application")}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              selectedListType === "Application"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Application ({applicationTweets.length})
          </button>
        </div>

        {/* Selection Controls */}
        {selectedTweets.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-blue-700">
                已選擇 {selectedTweets.size} 條推文
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  清除選擇
                </button>
                <button
                  onClick={generatePrompt}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                >
                  生成 Prompt
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayTweets.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              沒有找到瀏覽量超過 10,000 的推文
            </div>
          ) : (
            displayTweets.map((tweet) => (
              <div
                key={tweet.id}
                className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-all p-4 border ${
                  selectedTweets.has(tweet.tweet_id)
                    ? "ring-2 ring-blue-500 border-blue-500"
                    : ""
                }`}
              >
                {/* Checkbox and Header */}
                <div className="flex items-start gap-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedTweets.has(tweet.tweet_id)}
                    onChange={() => toggleTweetSelection(tweet.tweet_id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <div className="font-semibold text-gray-900 text-sm">
                          {/* Author Name */} {tweet.author_name}
                        </div>
                        <div className="font-medium text-gray-500 text-sm">
                          {/* Author Username */}@{tweet.author_username}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          tweet.list_type === "Core"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {tweet.list_type}
                      </span>
                    </div>

                    {/* Tweet Content */}
                    <div className="text-gray-800 text-xs mb-3 leading-relaxed">
                      {tweet.text.length > 150
                        ? tweet.text.substring(0, 150) + "..."
                        : tweet.text}
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                      <div className="flex gap-3">
                        <span className="font-semibold text-blue-600 flex items-center gap-1">
                          <Eye size={14} /> {formatNumber(tweet.view_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart size={14} /> {formatNumber(tweet.like_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat2 size={14} />{" "}
                          {formatNumber(tweet.retweet_count)}
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="text-xs text-gray-500 mb-3">
                      {formatDate(tweet.created_at)}
                    </div>

                    {/* Link */}
                    <a
                      href={tweet.tweet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-medium py-1.5 px-3 text-xs rounded transition-colors"
                    >
                      查看推文
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <footer className="mt-8 text-center text-gray-500 text-xs">
        顯示瀏覽量超過 10,000 的推文 • 由 Supabase 提供支持
      </footer>
    </div>
  );
}
