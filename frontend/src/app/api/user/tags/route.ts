// app/api/user/tags/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // 確保這個支援 Edge，如果你是用 RSC

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get("telegram_id");

  if (telegramId) {
    // 使用者登入情況，回傳 selected_tags
    const { data, error } = await supabase
      .from("user_preferences")
      .select("selected_tags")
      .eq("telegram_id", telegramId)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: "讀取標籤失敗" }, { status: 500 });
    }

    return NextResponse.json({ selected_tags: data?.selected_tags ?? [] });
  } else {
    // 未登入情況，回傳所有文章 tags
    const { data, error } = await supabase
      .from("articles")
      .select("tags")
      .order("scraped_date", { ascending: false })
      .limit(1000);

    if (error) {
      return NextResponse.json({ error: "取得 tags 失敗" }, { status: 500 });
    }

    const allTags = data
      ? data.flatMap((item: { tags: string[] | null }) => item.tags || [])
      : [];
    const uniqueTags = [...new Set(allTags.filter(Boolean))];

    return NextResponse.json({ tags: uniqueTags.sort() });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { telegram_id, selected_tags } = body;

  if (!telegram_id || !Array.isArray(selected_tags)) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      telegram_id,
      selected_tags,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "標籤偏好已保存",
  });
}
