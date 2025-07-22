import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const telegram_id = url.searchParams.get("telegram_id");

    if (!telegram_id) {
      return NextResponse.json(
        { error: "Missing telegram_id parameter" },
        { status: 400 }
      );
    }

    // Get user's selected sources
    const { data: userPref, error: userError } = await supabase
      .from("user_preferences")
      .select("selected_sources")
      .eq("telegram_id", telegram_id)
      .single();

    if (userError && userError.code !== "PGRST116") {
      console.error("Error fetching user sources:", userError);
      return NextResponse.json(
        { error: "Failed to fetch user sources" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      selected_sources: userPref?.selected_sources || [],
    });
  } catch (error) {
    console.error("Error in sources GET API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { telegram_id, selected_sources } = body;

    if (!telegram_id) {
      return NextResponse.json(
        { error: "Missing telegram_id" },
        { status: 400 }
      );
    }

    if (!Array.isArray(selected_sources)) {
      return NextResponse.json(
        { error: "selected_sources must be an array" },
        { status: 400 }
      );
    }

    // Upsert user sources preferences
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          telegram_id: telegram_id,
          selected_sources: selected_sources,
          updated_at: new Date(),
        },
        {
          onConflict: "telegram_id",
        }
      );

    if (error) {
      console.error("Error saving user sources:", error);
      return NextResponse.json(
        { error: "Failed to save sources preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: "Sources preferences saved successfully",
      selected_sources 
    });
  } catch (error) {
    console.error("Error in sources POST API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}