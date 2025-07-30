"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader, Check } from "lucide-react";
import type { TelegramUser } from "@/types";

interface PromptEditorProps {
  user: TelegramUser | null;
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
  );
}
