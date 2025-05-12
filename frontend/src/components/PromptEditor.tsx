// components/PromptEditor.tsx
"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PromptEditorProps {
  onPromptChange: (newPrompt: string) => void; // 用於傳遞 customPrompt 的函式
}

export function PromptEditor({ onPromptChange }: PromptEditorProps) {
  const [prompt, setPrompt] = useState("");

  // 當用戶輸入時更新 prompt 並通知父組件
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    onPromptChange(e.target.value); // 呼叫父組件傳遞函式
  };

  return (
    <div className="grid w-full gap-2 mb-4">
      <Textarea
        value={prompt}
        onChange={handleChange}
        placeholder="Type your Custom Prompt here."
      />
      <Button>Save Prompt</Button>
    </div>
  );
}
