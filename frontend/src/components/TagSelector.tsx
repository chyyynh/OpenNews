"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Search, X } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const searchContainer = searchRef.current?.closest('.relative');
      
      if (searchContainer && !searchContainer.contains(target)) {
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
    setShowSuggestions(true); // Always show suggestions when typing
    setFocusedIndex(-1);
  };

  // Handle input focus
  const handleInputFocus = () => {
    setShowSuggestions(true); // Always show suggestions when focused
  };

  // Handle tag selection
  const handleTagSelect = (tag: string) => {
    toggleTag(tag);
    setSearchQuery("");
    setShowSuggestions(false);
    setFocusedIndex(-1);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tag Select</h2>
        <Button
          onClick={saveUserPreferences}
          disabled={isSaving || !user}
          size="sm"
          variant="outline"
          className="text-xs h-7"
        >
          {isSaving ? (
            <>
              <Loader className="mr-1 h-3 w-3 animate-spin" />
              儲存中...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>

      {/* Search Input with Google-style suggestions */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={searchRef}
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            className="pl-10 text-sm h-9 rounded-full border-2 border-gray-200 focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Google-style suggestions */}
        {showSuggestions && filteredTags.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
            {filteredTags.map((tag, index) => (
              <div
                key={tag}
                className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                  index === focusedIndex 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleTagSelect(tag)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <Search className="inline w-3 h-3 mr-2 text-gray-400" />
                {tag}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Tags Display (Max 2 lines) */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden">
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
      )}
    </div>
  );
}
