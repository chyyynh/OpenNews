"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Search, ChevronDown, ChevronUp, Tags } from "lucide-react";
import type { AppUser } from "@/types";

interface CollapsibleTagSelectorProps {
  user: AppUser | null;
  tags: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  isSaving: boolean;
  saveUserPreferences: () => Promise<{ success: boolean; message: string }>;
}

export function CollapsibleTagSelector({
  user,
  tags,
  selectedTags,
  toggleTag,
  isSaving,
  saveUserPreferences,
}: CollapsibleTagSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter tags based on search query
  const filteredTags = tags.filter((tag) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 把選中的 tag 放前面，未選的放後面
  const orderedTags = [
    ...selectedTags.filter((tag) => filteredTags.includes(tag)),
    ...filteredTags.filter((tag) => !selectedTags.includes(tag)),
  ];

  return (
    <div className="border rounded-lg">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4" />
          <span className="text-sm font-medium">Tag Select</span>
          {selectedTags.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {selectedTags.length} 個
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t">
          <div className="space-y-3 mt-3">
            
            {/* Save Button */}
            <Button
              onClick={saveUserPreferences}
              disabled={isSaving || !user}
              size="sm"
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader className="mr-2 h-3 w-3 animate-spin" />
                  儲存中...
                </>
              ) : (
                "Save Tags"
              )}
            </Button>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input
                type="text"
                placeholder="搜尋標籤..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 text-sm h-8"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
              {orderedTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  size="sm"
                  className={`text-xs h-6 px-2 transition-all duration-200 ${
                    selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Button>
              ))}
              {orderedTags.length === 0 && searchQuery && (
                <p className="text-xs text-gray-500 w-full text-center py-2">
                  沒有找到符合 "{searchQuery}" 的標籤
                </p>
              )}
              {tags.length === 0 && !searchQuery && (
                <p className="text-xs text-gray-500 w-full text-center py-2">
                  未找到標籤
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}