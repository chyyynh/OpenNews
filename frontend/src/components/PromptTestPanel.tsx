"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PromptTestPanelProps {
  result?: {
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
  selectedArticle?: {
    id: string;
    title: string;
    summary?: string;
    content?: string;
  } | null;
  onClearResult?: () => void;
  onRetry?: () => void;
}

export function PromptTestPanel({
  result,
  selectedArticle,
  onClearResult,
}: PromptTestPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result?.response) return;

    try {
      await navigator.clipboard.writeText(result.response);
      setCopied(true);
      toast.success("已複製到剪貼簿");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("複製失敗");
    }
  };

  // Show selected article even without test result
  if (!result && !selectedArticle) {
    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
        <div className="text-center text-gray-500 text-sm">
          選擇文章並點擊測試按鈕查看結果
        </div>
      </div>
    );
  }

  // Show selected article without test result
  if (!result && selectedArticle) {
    return (
      <div className="space-y-4">
        {/* Selected Article Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium mb-1">已選中文章</div>
          <div className="text-sm font-medium text-blue-900">
            {selectedArticle.title}
          </div>
        </div>

        {/* Prompt hint */}
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 text-center">
            編輯 Prompt 後點擊「測試」按鈕查看 AI 回應
          </div>
        </div>
      </div>
    );
  }

  // At this point, we know result exists
  if (!result) return null;

  return (
    <div className=" space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-md font-medium">測試結果</h3>
        <div className="flex gap-2">
          {result.response && !result.isLoading && !result.error && (
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  已複製
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  複製
                </>
              )}
            </Button>
          )}
          {onClearResult && (
            <Button
              onClick={onClearResult}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              清除
            </Button>
          )}
        </div>
      </div>

      {/* Article Info */}
      {result.article && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 font-medium mb-1">測試文章</div>
          <div className="text-sm font-medium text-blue-900 line-clamp-2">
            {result.article.title}
          </div>
        </div>
      )}

      {/* Result */}
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="text-xs text-gray-600 font-medium mb-2">AI 回應</div>
        {result.isLoading ? (
          <div className="flex items-center gap-2 text-gray-500 py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">正在生成回應...</span>
          </div>
        ) : result.error ? (
          <div className="text-red-600 text-sm py-2">
            <div className="font-medium">錯誤：</div>
            <div className="mt-1">{result.error}</div>
          </div>
        ) : result.response ? (
          <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-80 overflow-y-auto">
            {result.response}
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-2">暫無回應</div>
        )}
      </div>
    </div>
  );
}
