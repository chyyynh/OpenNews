"use client";

import { PromptEditor } from "@/components/PromptEditor";
import { TagSelector } from "@/components/TagSelector";
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
}: CollapsibleSidebarProps) {

  return (
    <aside className="bg-white flex flex-col relative h-full w-full transition-all duration-500 ease-in-out border-l border-gray-200">
      {/* Content - Only show when expanded */}
      {!isCollapsed && (
        <div className="flex-1">
          <div className="p-4 pl-8 space-y-6">
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
              />
            </div>

            {/* Separator */}
            <hr className="border-gray-200" />

            {/* Tag Selector */}
            <div>
              <TagSelector
                user={user}
                tags={tags}
                selectedTags={selectedTags}
                toggleTag={toggleTag}
                isSaving={isSavingTags}
                saveUserPreferences={saveUserPreferences}
              />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}