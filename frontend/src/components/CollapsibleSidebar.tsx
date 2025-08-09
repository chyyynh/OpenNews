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
  onDeselectArticle?: (articleId: number) => void;
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
  onDeselectArticle,
  testResult,
  onClearTestResult,
  getArticleTitle,
}: CollapsibleSidebarProps) {
  return (
    <aside className="sticky bg-white w-full transition-all duration-500 ease-in-out border-l border-gray-200 top-4 self-start max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* Content - Only show when expanded */}
      {!isCollapsed && (
        <>
          {/* Test Results Panel - Scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6">
            <PromptTestPanel
              result={testResult}
              selectedArticles={selectedArticles}
              onClearResult={onClearTestResult}
              getArticleTitle={getArticleTitle}
            />
          </div>

          {/* Custom Prompt Editor - Sticky at bottom of sidebar */}
          <div className="flex-shrink-0 bg-white border-t border-gray-100 px-6 py-4">
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
              onDeselectArticle={onDeselectArticle}
              getArticleTitle={getArticleTitle}
            />
          </div>
        </>
      )}
    </aside>
  );
}
