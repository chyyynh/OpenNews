// /app/api/auth/telegram/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

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

    if (!telegramUser || !telegramUser.id || !telegramUser.hash) {
      return NextResponse.json(
        { error: "Missing telegram user fields" },
        { status: 400 }
      );
    }

    const isValid = isValidTelegramAuth(telegramUser, TELEGRAM_BOT_TOKEN);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Telegram login" },
        { status: 403 }
      );
    }

    const fakeEmail = `tg_${telegramUser.id}@telegram.local`;

    const jwtForSupabase = jwt.sign(
      {
        sub: `telegram_${telegramUser.id}`,
        email: fakeEmail,
        role: "authenticated",
        user_metadata: {
          telegram_id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          photo_url: telegramUser.photo_url,
        },
      },
      SUPABASE_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return NextResponse.json({ token: jwtForSupabase });
  } catch (err: any) {
    console.error("Telegram login error:", err);

    return new NextResponse(
      JSON.stringify({ error: err.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
