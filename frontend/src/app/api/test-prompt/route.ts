import { NextRequest, NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { article, prompt } = body;

    // Validate input
    if (!article || !prompt) {
      return NextResponse.json(
        { error: "Missing article or prompt" },
        { status: 400 }
      );
    }

    // Validate API key
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    // Prepare article content
    const articleContent = `
標題: ${article.title}
${article.summary ? `摘要: ${article.summary}` : ''}
${article.content ? `內容: ${article.content.substring(0, 2000)}` : ''}
網址: ${article.url}
`.trim();

    // Combine prompt with article content
    const fullPrompt = `
${prompt}

文章內容:
${articleContent}
`.trim();

    // Call OpenRouter API with retry logic
    const retries = 3;
    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`OpenRouter API attempt ${i + 1}...`);
        
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "user",
                content: fullPrompt,
              },
            ],
            max_tokens: 2000,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(
            errorData.error?.message || `OpenRouter API error: ${response.status} ${response.statusText}`
          );
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
          throw new Error("No response content from OpenRouter API");
        }
        
        // If successful, return the result
        return NextResponse.json({
          success: true,
          response: text,
          metadata: {
            articleTitle: article.title,
            promptUsed: prompt,
            timestamp: new Date().toISOString()
          }
        });
        
      } catch (apiError: any) {
        lastError = apiError;
        console.error(`OpenRouter API attempt ${i + 1} failed:`, apiError);
        
        // If it's a 503 (overloaded), 429 (rate limit), or 520-529 (server errors), wait and retry
        if ([503, 429, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529].includes(apiError.status)) {
          if (i < retries - 1) {
            const waitTime = Math.pow(2, i) * 1000; // Exponential backoff: 1s, 2s, 4s
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // For other errors, don't retry
        break;
      }
    }
    
    // If all retries failed, throw the last error
    throw lastError;

  } catch (error: any) {
    console.error("Test prompt API error:", error);
    
    // Handle specific API errors
    if (error?.status === 503 || [520, 521, 522, 523, 524, 525, 526, 527, 528, 529].includes(error?.status)) {
      return NextResponse.json(
        { 
          error: "OpenRouter 服務目前過載，請稍後再試。我們已嘗試多次重試但仍無法連接。",
          retryAfter: 60 // Suggest retry after 60 seconds
        },
        { status: 503 }
      );
    }
    
    if (error?.status === 429) {
      return NextResponse.json(
        { 
          error: "請求過於頻繁，請稍後再試。",
          retryAfter: 30
        },
        { status: 429 }
      );
    }
    
    if (error?.status === 400) {
      return NextResponse.json(
        { error: "請求內容有誤，請檢查您的 Prompt 內容。" },
        { status: 400 }
      );
    }

    if (error?.status === 401) {
      return NextResponse.json(
        { error: "OpenRouter API 授權失敗，請檢查 API 密鑰配置。" },
        { status: 500 }
      );
    }
    
    // Generic error handling
    const errorMessage = error instanceof Error ? error.message : "未知錯誤";
    return NextResponse.json(
      { error: `OpenRouter API 錯誤: ${errorMessage}` },
      { status: 500 }
    );
  }
}