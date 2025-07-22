import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('Available sources API called');
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Get all unique sources from articles table
    const { data, error } = await supabase
      .from("articles")
      .select("source")
      .order("source");

    if (error) {
      console.error("Supabase error fetching sources:", error);
      // Return fallback sources if DB fails
      const fallbackSources = ["OpenAI", "BWENEWS", "CNBC", "arXiv cs.LG", "arXiv cs.AI", "Google Deepmind"];
      return NextResponse.json({
        sources: fallbackSources,
        note: "Using fallback sources due to database error"
      });
    }

    console.log('Raw data from supabase:', data?.length, 'records');

    // Extract unique sources
    const uniqueSources = Array.from(
      new Set(data.map((item) => item.source).filter(Boolean))
    ).sort();

    console.log('Unique sources found:', uniqueSources);

    return NextResponse.json({
      sources: uniqueSources,
    });
  } catch (error) {
    console.error("Error in sources/available GET API:", error);
    // Return fallback sources on any error
    const fallbackSources = ["OpenAI", "BWENEWS", "CNBC", "arXiv cs.LG", "arXiv cs.AI", "Google Deepmind"];
    return NextResponse.json({
      sources: fallbackSources,
      note: "Using fallback sources due to error"
    });
  }
}