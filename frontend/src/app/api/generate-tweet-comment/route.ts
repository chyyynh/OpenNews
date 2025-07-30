import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required", requiresAuth: true },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, url, summary, customPrompt } = body;

    if (!title || !url) {
      return NextResponse.json(
        { error: "Missing title or URL" },
        { status: 400 }
      );
    }

    // DeepSeek API Call
    console.log("Received for DeepSeek:", {
      title,
      url,
      summary,
      customPrompt,
    });

    const prompt = `請針對以下新聞使用 "繁體中文" 撰寫一則適合發布在 Twitter 上的評論（限 200 字內) 不要附上連結
      ${customPrompt}
      標題: ${title}
      摘要: ${summary || "No summary available."}
      連結: ${url}`;

    console.log("Generated prompt for DeepSeek:", prompt);

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const comment = data.choices?.[0]?.message?.content;

    if (!comment) {
      return NextResponse.json(
        { error: "Failed to generate comment from DeepSeek" },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error in generate-tweet-comment API:", error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "An unknown error occurred" },
      { status: 500 }
    );
  }
}
