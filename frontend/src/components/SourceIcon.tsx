import {
  siOpenai,
  siGoogle,
  siGooglegemini,
  siAnthropic,
  siNbc,
  siTechcrunch,
  siArxiv,
  siYcombinator,
  siProducthunt,
  siArc,
  siPerplexity,
  siHuggingface,
  siAcm,
} from "simple-icons";

interface SourceIconProps {
  source: string;
  className?: string;
}

export function SourceIcon({ source, className = "w-4 h-4" }: SourceIconProps) {
  const getSourceIcon = (source: string) => {
    const iconMap: Record<string, any> = {
      openai: siOpenai,
      "google deepmind": siGooglegemini,
      "google research": siGoogle,
      "anthropic research": siAnthropic,
      cnbc: siNbc,
      techcrunch: siTechcrunch,
      "arxiv cs.lg": siArxiv,
      "arxiv cs.ai": siArxiv,
      "acm tiis": siAcm,
      "hacker news ai": siYcombinator,
      "hacker news show hn": siYcombinator,
      "product hunt - ai": siProducthunt,
      "browser company": siArc,
      perplexity: siPerplexity,
      huggingface: siHuggingface,
    };

    return iconMap[source.toLowerCase()] || null;
  };

  const icon = getSourceIcon(source);

  if (!icon) {
    return null;
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={icon.path} />
    </svg>
  );
}
