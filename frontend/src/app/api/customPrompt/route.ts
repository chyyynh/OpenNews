// api/customPrompt/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - 讀取 custom_prompt
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegram_id = searchParams.get("telegram_id");

  if (!telegram_id) {
    return NextResponse.json({ error: "缺少 telegram_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("custom_prompt")
    .eq("telegram_id", telegram_id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ custom_prompt: data.custom_prompt });
}

// POST - 儲存 custom_prompt
export async function POST(req: NextRequest) {
  const { telegram_id, custom_prompt } = await req.json();

  if (!telegram_id || !custom_prompt) {
    return NextResponse.json({ error: "缺少欄位" }, { status: 400 });
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      telegram_id,
      custom_prompt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "已成功更新 Prompt" });
}
