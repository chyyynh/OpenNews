import { useMemo } from "react";

const SOURCE_CATEGORIES = {
  "AI Firm": ["OpenAI", "Google Deepmind", "Google Research", "Anthropic"],
  News: ["CNBC", "Techcrunch"],
  Papers: ["arXiv cs.LG", "arXiv cs.AI"],
  Community: ["Hacker News AI", "Hacker News Show HN", "Product Hunt - AI"],
  Application: ["Browser Company", "Perplexity"],
};

export function useSourceCategories(sources: string[]) {
  const categorizedSources = useMemo(() => {
    const categorized: { [key: string]: string[] } = {};
    const uncategorized: string[] = [];

    sources.forEach((source) => {
      let found = false;
      for (const [category, categoryItems] of Object.entries(
        SOURCE_CATEGORIES
      )) {
        if (categoryItems.includes(source)) {
          if (!categorized[category]) {
            categorized[category] = [];
          }
          categorized[category].push(source);
          found = true;
          break;
        }
      }
      if (!found) {
        uncategorized.push(source);
      }
    });

    // Add uncategorized sources if any
    if (uncategorized.length > 0) {
      categorized["Others"] = uncategorized;
    }

    return categorized;
  }, [sources]);

  return categorizedSources;
}
