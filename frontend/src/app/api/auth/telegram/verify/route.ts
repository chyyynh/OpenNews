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

    const isValid = isValidTelegramAuth(telegramUser, TELEGRAM_BOT_TOKEN);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Telegram login" },
        { status: 403 }
      );
    }

    const fakeEmail = `tg_${telegramUser.id}@telegram.local`;

    // 🔐 用來 sign 給 Supabase 的 JWT，對應 signInWithIdToken
    const jwtForSupabase = jwt.sign(
      {
        sub: `telegram_${telegramUser.id}`, // 對應 user.id
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
