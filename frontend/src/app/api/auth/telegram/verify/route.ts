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

function isValidTelegramAuth(data: any, botToken: string): boolean {
  const { hash, ...dataToSign } = data;
  const sortedData = Object.keys(dataToSign)
    .sort()
    .map((key) => `${key}=${dataToSign[key]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(sortedData)
    .digest("hex");

  return hmac === hash;
}

export async function POST(req: NextRequest) {
  try {
    const telegramUser = await req.json();

    const isValid = isValidTelegramAuth(telegramUser, TELEGRAM_BOT_TOKEN);
    console.log("isValidTelegramAuth", isValid);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Telegram login" },
        { status: 403 }
      );
    }

    const fakeEmail = `tg_${telegramUser.id}@telegram.local`;

    const { data: userExists, error: fetchError } = await supabase
      .from("telegram_users")
      .select("*")
      .eq("telegram_id", telegramUser.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      throw new Error(`Supabase fetch error: ${fetchError.message}`);
    }

    if (!userExists) {
      const { error: insertError } = await supabase
        .from("telegram_users")
        .insert({
          telegram_id: telegramUser.id,
          username: telegramUser.username,
          custom_prompt: "",
          topics: [],
        });
      if (insertError)
        throw new Error(`Supabase insert error: ${insertError.message}`);
    }

    const token = jwt.sign(
      {
        sub: `telegram_${telegramUser.id}`,
        email: fakeEmail,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        user_metadata: {
          telegram_id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          photo_url: telegramUser.photo_url,
        },
      },
      SUPABASE_JWT_SECRET
    );

    return NextResponse.json({
      access_token: token,
      refresh_token: null,
      user: {
        id: `telegram_${telegramUser.id}`,
        email: fakeEmail,
      },
    });
  } catch (err: any) {
    console.error("Telegram login error:", err);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
