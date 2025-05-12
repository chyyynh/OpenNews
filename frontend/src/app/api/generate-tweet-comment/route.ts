import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// IMPORTANT: You will need to install the Gemini SDK and configure your API key.
// For example, using the official Google AI SDK:
// import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, url, summary } = body;

    if (!title || !url) {
      return NextResponse.json(
        { error: "Missing title or URL" },
        { status: 400 }
      );
    }

    // --- Placeholder for Gemini API Call ---
    // Replace this with your actual Gemini API call logic.
    // Ensure you handle API key security appropriately (e.g., environment variables).
    console.log("Received for Gemini:", { title, url, summary });

    // Example prompt structure (adjust as needed for Gemini 1.5 Flash)
    const prompt = `請針對以下新聞使用 "繁體中文" 撰寫一則適合發布在 Twitter 上的評論（限 200 字內) 不要附上連結
      標題: ${title}
      摘要: ${summary || "No summary available."}
      連結: ${url}`;

    console.log("Generated prompt for Gemini:", prompt); // Using the prompt variable
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const geminiComment = response.text();

    if (!geminiComment) {
      return NextResponse.json(
        { error: "Failed to generate comment from Gemini" },
        { status: 500 }
      );
    }

    return NextResponse.json({ comment: geminiComment });
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
