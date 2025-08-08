"use client";

import { PromptEditor } from "@/components/PromptEditor";
import { PromptTestPanel } from "@/components/PromptTestPanel";
import type { AppUser } from "@/types";

interface CollapsibleSidebarProps {
  user: AppUser | null;
  // PromptEditor props
  tempCustomPrompt: string;
  setTempCustomPrompt: (prompt: string) => void;
  isSavingPrompt: boolean;
  saveSuccess: boolean;
  handleSavePrompt: () => Promise<{ success: boolean; message: string }>;
  customPrompt: string;
  // TagSelector props
  tags: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  isSavingTags: boolean;
  saveUserPreferences: () => Promise<{ success: boolean; message: string }>;
  // External control
  isCollapsed?: boolean;
  // Test functionality props
  selectedArticles?: any[];
  onTestPrompt?: (articles: any[], prompt: string) => Promise<void>;
  testResult?: {
    prompt: string;
    article: {
      title: string;
      summary?: string;
      content?: string;
    };
    response: string;
    isLoading?: boolean;
    error?: string;
  } | null;
  onClearTestResult?: () => void;
  getArticleTitle?: (article: any) => string;
}

export function CollapsibleSidebar({
  user,
  tempCustomPrompt,
  setTempCustomPrompt,
  isSavingPrompt,
  saveSuccess,
  handleSavePrompt,
  customPrompt,
  tags,
  selectedTags,
  toggleTag,
  isSavingTags,
  saveUserPreferences,
  isCollapsed = false,
  selectedArticles,
  onTestPrompt,
  testResult,
  onClearTestResult,
  getArticleTitle,
}: CollapsibleSidebarProps) {
  return (
    <aside className="bg-white flex flex-col relative h-full w-full transition-all duration-500 ease-in-out border-l border-gray-200 sticky top-8 self-start max-h-screen overflow-hidden">
      {/* Content - Only show when expanded */}
      {!isCollapsed && (
        <div className="pt-4 p-4 pl-8 space-y-6 overflow-y-auto flex-1">
          {/* Custom Prompt Editor */}
          <div>
            <PromptEditor
              user={user}
              tempCustomPrompt={tempCustomPrompt}
              setTempCustomPrompt={setTempCustomPrompt}
              isSaving={isSavingPrompt}
              saveSuccess={saveSuccess}
              handleSavePrompt={handleSavePrompt}
              customPrompt={customPrompt}
              tags={tags}
              selectedTags={selectedTags}
              toggleTag={toggleTag}
              isSavingTags={isSavingTags}
              saveUserPreferences={saveUserPreferences}
              selectedArticles={selectedArticles}
              onTestPrompt={onTestPrompt}
              getArticleTitle={getArticleTitle}
            />
          </div>

          {/* Test Results Panel */}
          <div>
            <PromptTestPanel
              result={testResult}
              selectedArticles={selectedArticles}
              onClearResult={onClearTestResult}
              getArticleTitle={getArticleTitle}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
