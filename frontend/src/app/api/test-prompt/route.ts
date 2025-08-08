import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
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

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      success: true,
      response: text,
      metadata: {
        articleTitle: article.title,
        promptUsed: prompt,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Test prompt API error:", error);
    
    // Handle specific API errors
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `API Error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}