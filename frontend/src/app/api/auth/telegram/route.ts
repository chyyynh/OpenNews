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

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
  [key: string]: string | number | boolean | undefined; // More specific than any
}

function isValidTelegramAuth(
  data: TelegramAuthData,
  botToken: string
): boolean {
  const { hash, ...dataToSign } = data; // Destructure hash and the rest of the properties

  // Process dataToSign (which doesn't include hash)
  const sortedData = Object.keys(dataToSign)
    .sort()
    .map((key) => `${key}=${dataToSign[key]}`) // Access properties from dataToSign
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(sortedData)
    .digest("hex");

  return hmac === hash; // Compare with the destructured hash
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

  // let userId: string; // userId was defined but never used.

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
