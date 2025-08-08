"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Check, Tags, Search, X } from "lucide-react";
import type { AppUser } from "@/types";

interface PromptEditorProps {
  user: AppUser | null;
  tempCustomPrompt: string;
  setTempCustomPrompt: (prompt: string) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  handleSavePrompt: () => Promise<{ success: boolean; message: string }>;
  customPrompt: string;
  // Tag selector props
  tags: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  isSavingTags: boolean;
  saveUserPreferences: () => Promise<{ success: boolean; message: string }>;
  // Test functionality props
  selectedArticle?: any;
  onTestPrompt?: (article: any, prompt: string) => Promise<void>;
}

export function PromptEditor({
  user,
  tempCustomPrompt,
  setTempCustomPrompt,
  isSaving,
  saveSuccess,
  handleSavePrompt,
  customPrompt,
  tags,
  selectedTags,
  toggleTag,
  isSavingTags,
  saveUserPreferences,
  selectedArticle,
  onTestPrompt,
}: PromptEditorProps) {
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [tagSaveSuccess, setTagSaveSuccess] = useState(false);
  const [isTestingPrompt, setIsTestingPrompt] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter tags based on search query
  const filteredTags = tags.filter((tag) => {
    const matchesSearch = searchQuery.length === 0 || 
      tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && !selectedTags.includes(tag);
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredTags.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredTags.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : filteredTags.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && filteredTags[focusedIndex]) {
          toggleTag(filteredTags[focusedIndex]);
          setSearchQuery("");
          setShowSuggestions(false);
          setFocusedIndex(-1);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setFocusedIndex(-1);
        searchRef.current?.blur();
        break;
    }
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (containerRef.current && !containerRef.current.contains(target)) {
        setShowTagSelector(false);
        setShowSuggestions(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSuggestions(true);
    setFocusedIndex(-1);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setShowSuggestions(true);
  };

  // Handle tag selection
  const handleTagSelect = (tag: string) => {
    toggleTag(tag);
    setSearchQuery("");
    setShowSuggestions(false);
    setFocusedIndex(-1);
  };

  // Handle tag save
  const handleTagSave = async () => {
    const result = await saveUserPreferences();
    if (result.success) {
      setTagSaveSuccess(true);
      setTimeout(() => setTagSaveSuccess(false), 2000);
    }
  };

  // Handle test prompt
  const handleTestPrompt = async () => {
    if (!selectedArticle || !onTestPrompt || !tempCustomPrompt.trim()) return;
    
    setIsTestingPrompt(true);
    try {
      await onTestPrompt(selectedArticle, tempCustomPrompt);
    } catch (error) {
      console.error('Test prompt error:', error);
    } finally {
      setIsTestingPrompt(false);
    }
  };
  return (
    <div className="rounded-lg p-4 md:p-0" ref={containerRef}>
      <h2 className="text-lg font-semibold mb-3">Custom Prompt</h2>
      <div className="relative w-full">
        <Textarea
          placeholder="載入自定義提示詞..."
          value={tempCustomPrompt}
          onChange={(e) => setTempCustomPrompt(e.target.value)}
          className="min-h-[80px] pr-44 resize-none"
        />
        
        {/* Selected Tags Display */}
        {selectedTags.length > 0 && (
          <div className="absolute top-2 left-3 right-44 flex flex-wrap gap-1 pointer-events-none">
            {selectedTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-xs"
              >
                {tag}
              </span>
            ))}
            {selectedTags.length > 3 && (
              <span className="text-xs text-gray-500">+{selectedTags.length - 3} more</span>
            )}
          </div>
        )}

        {/* Tags Button */}
        <Button
          onClick={() => setShowTagSelector(!showTagSelector)}
          className={`absolute bottom-2 right-28 h-8 w-8 p-0 transition-colors ${
            showTagSelector ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          variant="ghost"
        >
          <Tags className="h-4 w-4" />
        </Button>

        {/* Test Button */}
        <Button
          onClick={handleTestPrompt}
          disabled={isTestingPrompt || !selectedArticle || !tempCustomPrompt.trim() || !user}
          className={`absolute bottom-2 right-14 h-8 px-2 text-xs transition-colors ${
            isTestingPrompt || !selectedArticle || !tempCustomPrompt.trim() || !user
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
          title={!selectedArticle ? "請先選擇一篇文章" : "測試當前 Prompt"}
        >
          {isTestingPrompt ? (
            <Loader className="h-3 w-3 animate-spin" />
          ) : (
            "測試"
          )}
        </Button>

        {/* Save Button */}
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

        {/* Tag Selector Dropdown */}
        {showTagSelector && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-3">
              {/* Search Input */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={searchRef}
                  type="text"
                  placeholder="搜尋標籤..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  onKeyDown={handleKeyDown}
                  className="pl-10 text-sm h-9 rounded-full border-2 border-gray-200 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-2">已選擇的標籤:</div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs border border-blue-200"
                      >
                        {tag}
                        <button
                          onClick={() => toggleTag(tag)}
                          className="ml-1 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          title={`移除 ${tag}`}
                        >
                          <X className="h-2 w-2" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag Suggestions */}
              {filteredTags.length > 0 && (
                <div className="max-h-48 overflow-y-auto mb-3">
                  <div className="text-xs text-gray-500 mb-2">可選擇的標籤:</div>
                  {filteredTags.map((tag, index) => (
                    <div
                      key={tag}
                      className={`px-3 py-2 cursor-pointer text-sm transition-colors rounded ${
                        index === focusedIndex 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleTagSelect(tag)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <Tags className="inline w-3 h-3 mr-2 text-gray-400" />
                      {tag}
                    </div>
                  ))}
                </div>
              )}

              {/* Save Tags Button */}
              <Button
                onClick={handleTagSave}
                disabled={isSavingTags || !user}
                className={`w-full h-8 text-xs transition-colors ${
                  isSavingTags || !user
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-black text-white hover:bg-gray-800"
                }`}
              >
                {isSavingTags ? (
                  <>
                    <Loader className="mr-1 h-3 w-3 animate-spin" />
                    保存標籤中
                  </>
                ) : tagSaveSuccess ? (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    標籤已保存
                  </>
                ) : (
                  "保存標籤設定"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
