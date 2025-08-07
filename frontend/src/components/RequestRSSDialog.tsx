"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader, Send } from "lucide-react";
import { toast } from "sonner";

interface RequestRSSDialogProps {
  className?: string;
}

interface FormData {
  url: string;
  sourceName: string;
  category: string;
  description: string;
  requestedBy: string;
}

export function RequestRSSDialog({ className }: RequestRSSDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    url: "",
    sourceName: "",
    category: "",
    description: "",
    requestedBy: "",
  });

  const handleInputChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setFormData({
      url: "",
      sourceName: "",
      category: "",
      description: "",
      requestedBy: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.url || !formData.sourceName || !formData.requestedBy) {
      toast.error("請填寫必填欄位（RSS URL、來源名稱、申請人）");
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.url);
    } catch {
      toast.error("請輸入有效的 RSS URL");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/request-rss", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("RSS 請求已提交！我們會盡快審核並添加。");
        resetForm();
        setIsOpen(false);
      } else {
        const error = await response.json();
        toast.error(error.message || "提交失敗，請重試");
      }
    } catch (error) {
      console.error("Submit RSS request error:", error);
      toast.error("提交失敗，請檢查網路連接");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${className}`}
        >
          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
          Request RSS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>申請新的 RSS 來源</DialogTitle>
          <DialogDescription>
            請填寫以下資訊來申請添加新的 RSS 來源。我們會審核後盡快添加到系統中。
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="url" className="text-sm font-medium">
              RSS URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={formData.url}
              onChange={(e) => handleInputChange("url", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sourceName" className="text-sm font-medium">
              來源名稱 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sourceName"
              type="text"
              placeholder="例如：TechCrunch, Hacker News"
              value={formData.sourceName}
              onChange={(e) => handleInputChange("sourceName", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="category" className="text-sm font-medium">
              分類
            </Label>
            <Input
              id="category"
              type="text"
              placeholder="例如：Tech, News, AI, Finance"
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="text-sm font-medium">
              描述
            </Label>
            <Textarea
              id="description"
              placeholder="簡述這個 RSS 來源的內容和價值..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="text-sm min-h-[80px]"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="requestedBy" className="text-sm font-medium">
              申請人 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="requestedBy"
              type="text"
              placeholder="您的姓名或用戶名"
              value={formData.requestedBy}
              onChange={(e) => handleInputChange("requestedBy", e.target.value)}
              className="text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
              className="text-sm"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader className="mr-2 h-3 w-3 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-3 w-3" />
                  提交申請
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}