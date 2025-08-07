"use client";

import { Button } from "@/components/ui/button";
import { Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { memo } from "react";

interface KOLModeToggleProps {
  isEnabled: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
  className?: string;
}

export const KOLModeToggle = memo(function KOLModeToggle({
  isEnabled,
  isCollapsed = false,
  onClick,
  className = "",
}: KOLModeToggleProps) {
  return (
    <Button
      variant={isEnabled ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={`
        flex items-center gap-2 transition-all duration-300 ease-in-out
        ${isEnabled 
          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' 
          : 'hover:bg-gray-50 border-gray-300'
        }
        ${className}
      `}
    >
      {!isEnabled ? (
        <>
          <Settings className="h-4 w-4 transition-transform duration-200" />
          <span className="hidden sm:inline text-sm">Dashboard</span>
        </>
      ) : isCollapsed ? (
        <>
          <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
          <span className="hidden sm:inline text-sm">展開 Dashboard</span>
        </>
      ) : (
        <>
          <ChevronRight className="h-4 w-4 transition-transform duration-200" />
          <span className="hidden sm:inline text-sm">收縮 Dashboard</span>
        </>
      )}
    </Button>
  );
});