// api/customPrompt/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - 讀取 custom_prompt
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  if (!user_id) {
    return NextResponse.json({ error: "缺少 user_id" }, { status: 400 });
  }

  try {
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { user_id },
      select: { custom_prompt: true }
    });

    return NextResponse.json({ 
      custom_prompt: userPreferences?.custom_prompt || null 
    });
  } catch (error) {
    console.error("Error fetching custom prompt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - 儲存 custom_prompt
export async function POST(req: NextRequest) {
  const { user_id, custom_prompt } = await req.json();

  if (!user_id || !custom_prompt) {
    return NextResponse.json({ error: "缺少欄位" }, { status: 400 });
  }

  try {
    await prisma.userPreferences.upsert({
      where: { user_id },
      update: {
        custom_prompt,
        updated_at: new Date(),
      },
      create: {
        user_id,
        custom_prompt,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ message: "已成功更新 Prompt" });
  } catch (error) {
    console.error("Error saving custom prompt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
