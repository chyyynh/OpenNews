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
}

export function TagSelector({
  user,
  tags,
  selectedTags,
  toggleTag,
  isSaving,
  saveUserPreferences,
}: TagSelectorProps) {
  return (
    <div className="rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
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

      {selectedTags.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">已選擇的標籤:</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedTags.map((tag) => (
              <div
                key={tag}
                className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm flex items-center"
                style={{
                  backgroundColor: `${getComputedStyle(
                    document.documentElement
                  ).getPropertyValue("--tg-theme-button-color")}20`,
                  color: "var(--tg-theme-button-color)",
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}
