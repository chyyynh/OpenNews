// /app/api/auth/telegram/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, supabaseServiceRoleKey);

function isValidTelegramAuth(
  data: Record<string, any>,
  botToken: string
): boolean {
  const checkHash = data.hash;
  const authData = { ...data };
  delete authData.hash;

  const sortedData = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();

  const cryptoHmac = require("crypto")
    .createHmac("sha256", secret)
    .update(sortedData)
    .digest("hex");

  return cryptoHmac === checkHash;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const telegramUser = body;

  // 1. 驗證 Telegram hash
  const isValid = isValidTelegramAuth(telegramUser, TELEGRAM_BOT_TOKEN);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid Telegram login" },
      { status: 403 }
    );
  }

  // 2. 建立 "假的" Email
  const fakeEmail = `tg_${telegramUser.id}@telegram.local`;

  // 3. 查詢或創建 user
  const { data: userExists } = await supabase
    .from("telegram_users")
    .select("*")
    .eq("telegram_id", telegramUser.id)
    .single();

  let userId: string;

  if (!userExists) {
    // create user metadata
    const payload = {
      sub: `tg_${telegramUser.id}`,
      email: fakeEmail,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 一週
      user_metadata: {
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        photo_url: telegramUser.photo_url,
      },
    };

    // 4. 產生 JWT token
    const token = jwt.sign(payload, SUPABASE_JWT_SECRET);

    // 5. 寫入 user 資料到自定義表
    await supabase.from("telegram_users").insert({
      telegram_id: telegramUser.id,
      username: telegramUser.username,
      custom_prompt: "",
      topics: [],
    });

    return NextResponse.json({
      access_token: token,
      refresh_token: null,
      user: {
        id: `tg_${telegramUser.id}`,
        email: fakeEmail,
      },
    });
  } else {
    // 如果已存在，就直接產生 token
    const payload = {
      sub: `tg_${telegramUser.id}`,
      email: fakeEmail,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };
    const token = jwt.sign(payload, SUPABASE_JWT_SECRET);
    return NextResponse.json({
      access_token: token,
      refresh_token: null,
      user: {
        id: `tg_${telegramUser.id}`,
        email: fakeEmail,
      },
    });
  }
}
