"use client";

import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import type { TelegramUser } from "@/types";

interface TagSelectorProps {
  user: TelegramUser | null;
  tags: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  isSaving: boolean;
  saveUserPreferences: () => Promise<{ success: boolean; message: string }>;
  // New props for sources
  sources?: string[];
  selectedSources?: string[];
  toggleSource?: (source: string) => void;
  isSavingSources?: boolean;
  saveUserSourcePreferences?: () => Promise<{
    success: boolean;
    message: string;
  }>;
}

export function TagSelector({
  user,
  tags,
  selectedTags,
  toggleTag,
  isSaving,
  saveUserPreferences,
  sources = [],
  selectedSources = [],
  toggleSource,
  isSavingSources = false,
  saveUserSourcePreferences,
}: TagSelectorProps) {
  // Debug logs
  console.log("TagSelector sources length:", sources.length);
  console.log("TagSelector sources array:", sources);
  console.log("TagSelector selectedSources:", selectedSources);
  console.log("TagSelector toggleSource exists:", !!toggleSource);
  console.log(
    "TagSelector saveUserSourcePreferences exists:",
    !!saveUserSourcePreferences
  );

  // 把選中的 tag 放前面，未選的放後面
  const orderedTags = [
    ...selectedTags,
    ...tags.filter((tag) => !selectedTags.includes(tag)),
  ];

  // 把選中的 source 放前面，未選的放後面
  const orderedSources = [
    ...selectedSources,
    ...sources.filter((source) => !selectedSources.includes(source)),
  ];

  return (
    <div className="space-y-6">
      {/* Tags Section */}
      <div className="rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">選擇標籤</h2>
          <Button
            onClick={saveUserPreferences}
            disabled={isSaving || !user}
            size="sm"
            className="tg-button"
            style={{
              backgroundColor: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {isSaving ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                儲存中...
              </>
            ) : (
              "儲存標籤偏好"
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
          {orderedTags.map((tag) => (
            <Button
              key={tag}
              variant="outline"
              className={`px-2 text-base border ${
                selectedTags.includes(tag)
                  ? "bg-black text-white border-transparent"
                  : "text-[var(--tg-theme-button-color)] border-[var(--tg-theme-button-color)]"
              }`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Button>
          ))}
          {tags.length === 0 && (
            <p className="text-sm text-gray-500">未找到標籤。</p>
          )}
        </div>
      </div>
    </div>
  );
}
