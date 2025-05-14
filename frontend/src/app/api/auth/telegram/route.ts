import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Telegram Bot Token，用於驗證
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

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

    // 驗證 Telegram 登入資料
    const isValid = isValidTelegramAuth(telegramUser, TELEGRAM_BOT_TOKEN);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Telegram login" },
        { status: 403 }
      );
    }

    // 根據 Telegram 資料生成一個自訂的 JWT，這個會作為後續 API 的驗證 token
    const telegramUserData = {
      sub: `telegram_${telegramUser.id}`,
      telegram_id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      photo_url: telegramUser.photo_url,
    };

    // 使用 JWT 簽名來生成一個 token
    const token = crypto.randomBytes(64).toString("hex"); // 這裡簡單地生成一個隨機 token 作為範例，你可以根據需求生成更多信息

    // 回傳生成的 token
    return NextResponse.json({ token });
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
