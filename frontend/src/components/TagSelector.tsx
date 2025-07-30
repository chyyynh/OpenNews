"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";
import type { AppUser } from "@/types";

interface TagSelectorProps {
  user: AppUser | null;
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
  // 把選中的 tag 放前面，未選的放後面
  const orderedTags = [
    ...selectedTags,
    ...tags.filter((tag) => !selectedTags.includes(tag)),
  ];

  return (
    <div className="space-y-6">
      {/* Tags Section */}
      <div className="rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Tag Select</h2>
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
              "Save Tags"
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto">
          {orderedTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTags.includes(tag) ? "default" : "outline"}
              size="sm"
              className={`transition-all duration-200 ${
                selectedTags.includes(tag)
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-accent hover:text-accent-foreground"
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
