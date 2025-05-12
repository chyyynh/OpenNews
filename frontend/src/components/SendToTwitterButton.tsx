"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button"; // Assuming you have a Button component

interface SendToTwitterButtonProps {
  articleTitle: string;
  articleUrl: string;
  articleSummary: string | null;
}

export function SendToTwitterButton({
  articleTitle,
  articleUrl,
  articleSummary,
}: SendToTwitterButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendToTwitter = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-tweet-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: articleTitle,
          url: articleUrl,
          summary: articleSummary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate comment");
      }

      const data = await response.json();
      const comment = data.comment;

      if (comment) {
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          comment
        )}\n\n${articleUrl}`;
        window.open(twitterIntentUrl, "_blank");
      } else {
        throw new Error("Received an empty comment from the API.");
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error sending to Twitter:", err);
        setError(err.message);
      } else {
        console.error("An unknown error occurred:", err);
        setError("An unknown error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <Button
        onClick={handleSendToTwitter}
        disabled={isLoading}
        variant="outline"
        size="sm"
      >
        {isLoading ? "Generating..." : "Send To Twitter"}
      </Button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
