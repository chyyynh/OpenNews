"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PromptTestResultProps {
  isVisible: boolean;
  onClose: () => void;
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
}

export function PromptTestResult({ 
  isVisible, 
  onClose, 
  result 
}: PromptTestResultProps) {
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

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Prompt 測試結果</h3>
          <div className="flex gap-2">
            {result?.response && (
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    複製結果
                  </>
                )}
              </Button>
            )}
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Article Info */}
          {result?.article && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <h4 className="font-medium mb-2">測試文章：</h4>
              <div className="text-sm">
                <div className="font-medium">{result.article.title}</div>
                {(result.article.summary || result.article.content) && (
                  <div className="text-gray-600 mt-1 line-clamp-3">
                    {result.article.summary || result.article.content}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt */}
          {result?.prompt && (
            <div className="border rounded-lg p-3 bg-blue-50">
              <h4 className="font-medium mb-2">使用的 Prompt：</h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {result.prompt}
              </div>
            </div>
          )}

          {/* Result */}
          <div className="border rounded-lg p-3">
            <h4 className="font-medium mb-2">AI 回應：</h4>
            {result?.isLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                正在生成回應...
              </div>
            ) : result?.error ? (
              <div className="text-red-600 text-sm">
                錯誤：{result.error}
              </div>
            ) : result?.response ? (
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {result.response}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">暫無回應</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex justify-end">
            <Button onClick={onClose}>關閉</Button>
          </div>
        </div>
      </div>
    </div>
  );
}