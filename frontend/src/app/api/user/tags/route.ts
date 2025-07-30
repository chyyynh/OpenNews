// app/api/user/tags/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { supabase } from "@/lib/supabase";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (user_id) {
    // 使用者登入情況，回傳 selected_tags
    try {
      const userPreferences = await prisma.userPreferences.findUnique({
        where: { user_id },
        select: { selected_tags: true }
      });

      return NextResponse.json({ 
        selected_tags: userPreferences?.selected_tags || [] 
      });
    } catch (error) {
      console.error("Error fetching user tags:", error);
      return NextResponse.json({ error: "讀取標籤失敗" }, { status: 500 });
    }
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
  const { user_id, selected_tags } = body;

  if (!user_id || !Array.isArray(selected_tags)) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }

  try {
    await prisma.userPreferences.upsert({
      where: { user_id },
      update: {
        selected_tags,
        updated_at: new Date(),
      },
      create: {
        user_id,
        selected_tags,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "標籤偏好已保存",
    });
  } catch (error) {
    console.error("Error saving user tags:", error);
    return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
  }
}
