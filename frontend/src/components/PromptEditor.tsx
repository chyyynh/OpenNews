"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader, Check } from "lucide-react";
import type { AppUser } from "@/types";

interface PromptEditorProps {
  user: AppUser | null;
  tempCustomPrompt: string;
  setTempCustomPrompt: (prompt: string) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  handleSavePrompt: () => Promise<{ success: boolean; message: string }>;
  customPrompt: string;
}

export function PromptEditor({
  user,
  tempCustomPrompt,
  setTempCustomPrompt,
  isSaving,
  saveSuccess,
  handleSavePrompt,
  customPrompt,
}: PromptEditorProps) {
  return (
    <div className="rounded-lg p-4 md:p-0">
      <h2 className="text-lg font-semibold mb-3">Custom Prompt</h2>
      <div className="relative w-full">
        <Textarea
          placeholder="載入自定義提示詞..."
          value={tempCustomPrompt}
          onChange={(e) => setTempCustomPrompt(e.target.value)}
          className="min-h-[80px] pr-20 resize-none"
        />
        <Button
          onClick={handleSavePrompt}
          disabled={isSaving || tempCustomPrompt === customPrompt || !user}
          className={`absolute bottom-2 right-2 h-8 px-3 text-xs transition-colors ${
            isSaving || tempCustomPrompt === customPrompt || !user
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : "bg-black text-white hover:bg-gray-800"
          }`}
        >
          {isSaving ? (
            <>
              <Loader className="mr-1 h-3 w-3 animate-spin" />
              保存中
            </>
          ) : saveSuccess ? (
            <>
              <Check className="mr-1 h-3 w-3" />
              已保存
            </>
          ) : (
            "保存"
          )}
        </Button>
      </div>
    </div>
  );
}
