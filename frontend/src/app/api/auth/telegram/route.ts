import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Loaded from .env.local
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!; // Loaded from .env.local

interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Function to verify Telegram data
// Reference: https://core.telegram.org/widgets/login#checking-authorization
function verifyTelegramAuth(
  data: Omit<TelegramUserData, "hash">,
  botToken: string
): string {
  const dataCheckArr = [];
  for (const key in data) {
    dataCheckArr.push(`${key}=${data[key as keyof typeof data]}`);
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString);
  return hmac.digest("hex");
}

export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("Telegram Bot Token is not configured.");
    return NextResponse.json(
      { error: "Internal server error: Telegram Bot Token missing" },
      { status: 500 }
    );
  }
  if (!supabaseServiceRoleKey) {
    console.error("Supabase Service Role Key is not configured.");
    return NextResponse.json(
      { error: "Internal server error: Supabase Service Role Key missing" },
      { status: 500 }
    );
  }

  try {
    const telegramUser = (await req.json()) as TelegramUserData;
    const { hash, ...userDataWithoutHash } = telegramUser;

    if (!hash) {
      return NextResponse.json(
        { error: "Hash is missing from Telegram data" },
        { status: 400 }
      );
    }

    const calculatedHash = verifyTelegramAuth(
      userDataWithoutHash,
      TELEGRAM_BOT_TOKEN
    );

    if (calculatedHash !== hash) {
      console.warn(
        "Telegram hash verification failed. Calculated:",
        calculatedHash,
        "Received:",
        hash
      );
      return NextResponse.json(
        { error: "Invalid Telegram data: Hash verification failed" },
        { status: 403 }
      );
    }

    // At this point, the Telegram user data is verified.
    // Now, find or create a user in Supabase.
    const telegramId = userDataWithoutHash.id.toString();

    // Option 1: Check if user exists by a custom claim or metadata
    // This example assumes you might store telegram_id in user_metadata
    // A more robust way is to have a separate 'identities' table or use Supabase's built-in identity linking if possible.

    const { data: existingUser, error: findError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("raw_user_meta_data->>telegram_id", telegramId) // Example: query metadata
      .single();

    if (findError && findError.code !== "PGRST116") {
      // PGRST116: Row not found (expected if user is new)
      console.error("Error finding user by Telegram ID:", findError);
      return NextResponse.json(
        { error: "Error finding user" },
        { status: 500 }
      );
    }

    let authUser = existingUser;

    if (!existingUser) {
      // User does not exist, create a new one
      // For simplicity, we're creating a user without email/password, relying on Telegram ID.
      // You might want to prompt for an email or handle this differently.
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          // email: `${telegramId}@telegram.user`, // Dummy email if required, or handle differently
          user_metadata: {
            telegram_id: telegramId,
            first_name: userDataWithoutHash.first_name,
            last_name: userDataWithoutHash.last_name,
            telegram_username: userDataWithoutHash.username,
            telegram_photo_url: userDataWithoutHash.photo_url,
          },
          // email_confirm: true, // Auto-confirm if using a dummy email
        });

      if (createError) {
        console.error("Error creating Supabase user:", createError);
        return NextResponse.json(
          { error: "Could not create user" },
          { status: 500 }
        );
      }
      authUser = newUser.user;
    } else {
      // Optionally update metadata if user exists
      const { error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          user_metadata: {
            ...existingUser.user_metadata, // preserve existing metadata
            first_name: userDataWithoutHash.first_name,
            last_name: userDataWithoutHash.last_name,
            telegram_username: userDataWithoutHash.username,
            telegram_photo_url: userDataWithoutHash.photo_url,
            // last_login_with_telegram: new Date().toISOString(),
          },
        });
      if (updateError) {
        console.warn("Could not update user metadata:", updateError.message);
        // Non-critical, proceed
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Could not retrieve or create user" },
        { status: 500 }
      );
    }

    // Generate a session for the user.
    // For API routes, we can't directly set cookies for the client's browser easily.
    // Instead, we can sign a custom JWT if Supabase is configured for it,
    // or use a method that allows the client to establish the session.
    // A simpler approach for now: return user info and let client handle session.
    // For a more robust solution, you'd typically generate a JWT here that the client can use.
    // Supabase client `setSession` requires access_token and refresh_token.
    // The admin SDK can't directly create these for a user without a password or OAuth flow.
    // One way is to use `admin.generateLink` to get a secure link, but that's for email.

    // For now, let's assume the client will use the user object to update its state,
    // and subsequent Supabase calls from client will be anonymous or require re-auth via UI.
    // A proper solution would involve custom JWTs or a more involved session creation.
    // This is a placeholder for robust session generation.
    // A common pattern is to return the user object and let the client call `supabase.auth.refreshSession()`
    // if it was already logged in, or if you can create a custom session token.

    // For this example, we'll just return the user object.
    // The client will need to handle this. A more complete solution would involve
    // returning session tokens.
    return NextResponse.json({
      message: "User authenticated successfully via Telegram.",
      user: {
        id: authUser.id,
        aud: authUser.aud,
        role: authUser.role,
        email: authUser.email,
        user_metadata: authUser.user_metadata,
        // IMPORTANT: Do not return sensitive session tokens directly like this in a real app
        // without proper session management (e.g., custom JWTs, or secure session setup).
        // This is simplified for demonstration.
      },
    });
  } catch (error) {
    console.error("Error in Telegram auth callback:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
