"use client";

import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

import { useTelegramUser } from "@/hooks/useTelegramUser";
import { useTags } from "@/hooks/useTags";
import { useCustomPrompt } from "@/hooks/useCustomPrompt";
import { UserDisplay } from "@/components/UserDisplay";
import { PromptEditor } from "@/components/PromptEditor";
import { TagSelector } from "@/components/TagSelector";

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

// Remove duplicate Window interface extension if already declared elsewhere
// (e.g., in src/types/index.ts). If you need to extend, do it only once in a shared types file.

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
  // Custom hooks
  const { user, isLoading: isUserLoading } = useTelegramUser();
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

  // Handle saving prompt with toast notifications
  const handleSavePromptWithToast = async () => {
    const result = await handleSavePrompt();
    if (result.success) {
      toast.success(result.message);
    } else {
      toast(result.message, { duration: 2000 });
    }
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

  return (
    <div
      className="container mx-auto p-4 sm:p-6 font-[family-name:var(--font-geist-sans)]"
      style={{
        backgroundColor: "var(--tg-theme-bg-color)",
        color: "var(--tg-theme-text-color)",
      }}
    >
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">OpenNews Setting</h1>
        <UserDisplay user={user} />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Prompt Editor */}
        <PromptEditor
          user={user}
          tempCustomPrompt={tempCustomPrompt}
          setTempCustomPrompt={setTempCustomPrompt}
          isSaving={isSavingPrompt}
          saveSuccess={saveSuccess}
          handleSavePrompt={handleSavePrompt}
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

      <footer className="mt-8 text-center text-gray-500 text-sm">
        由 Next.js 和 Supabase 提供支持
      </footer>
    </div>
  );
}
