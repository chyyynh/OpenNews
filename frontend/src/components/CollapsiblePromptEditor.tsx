"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader, Check, ChevronDown, ChevronUp, Edit3 } from "lucide-react";
import type { AppUser } from "@/types";

interface CollapsiblePromptEditorProps {
  user: AppUser | null;
  tempCustomPrompt: string;
  setTempCustomPrompt: (prompt: string) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  handleSavePrompt: () => Promise<{ success: boolean; message: string }>;
  customPrompt: string;
}

export function CollapsiblePromptEditor({
  user,
  tempCustomPrompt,
  setTempCustomPrompt,
  isSaving,
  saveSuccess,
  handleSavePrompt,
  customPrompt,
}: CollapsiblePromptEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4" />
          <span className="text-sm font-medium">Custom Prompt</span>
          {customPrompt && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              已設定
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
          <div className="grid w-full gap-3 mt-3">
            <Textarea
              placeholder="輸入自定義提示詞..."
              value={tempCustomPrompt}
              onChange={(e) => setTempCustomPrompt(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button
              onClick={handleSavePrompt}
              disabled={isSaving || tempCustomPrompt === customPrompt || !user}
              size="sm"
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader className="mr-2 h-3 w-3 animate-spin" />
                  正在保存...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="mr-2 h-3 w-3" />
                  已保存
                </>
              ) : (
                "保存提示詞"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}