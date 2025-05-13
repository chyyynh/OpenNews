// component/TelegramLoginButton.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Import for redirection
import { createClient } from "@supabase/supabase-js";
import Script from "next/script"; // Import Next.js Script component

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SupabaseUser {
  id: string;
  user_metadata?: {
    telegram_username?: string;
    // Add other potential user_metadata fields here
  };
  // Add other top-level user fields if known (e.g., email, created_at)
}

interface TelegramUserData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUserData) => void;
    onTelegramAuthCallback?: (user: TelegramUserData) => Promise<void>;
  }
}

const TelegramLoginButton: React.FC = () => {
  const router = useRouter(); // Initialize router
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null); // To store Supabase user info

  useEffect(() => {
    const handleTelegramLogin = async (telegramUser: TelegramUserData) => {
      setIsLoading(true);
      setError(null);
      setSupabaseUser(null);
      console.log("Telegram user data received by React:", telegramUser);

      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(telegramUser),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || `API request failed with status ${response.status}`
          );
        }

        console.log("Supabase auth successful, API result:", result);

        if (result.access_token && result.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          });

          if (sessionError) {
            console.error("Failed to set Supabase session:", sessionError);
            throw new Error(
              `Failed to set Supabase session: ${sessionError.message}`
            );
          }
          console.log("Supabase session set successfully on the client.");
          // After setting session, result.user should ideally be the user for this session.
          // Or, you could fetch the user fresh: const { data: { user } } = await supabase.auth.getUser();
          setSupabaseUser(result.user); // Assuming result.user is the correct user object
          alert(
            `Successfully authenticated with Supabase via Telegram! User ID: ${result.user?.id}`
          );
        } else if (result.user) {
          // Fallback if tokens are not provided but user info is (e.g., backend handles session entirely)
          setSupabaseUser(result.user);
          alert(
            `Successfully authenticated (user info only) via Telegram! User ID: ${result.user?.id}`
          );
        } else {
          throw new Error(
            "Authentication response did not include session tokens or user data."
          );
        }

        router.push("/"); // Redirect to home page
      } catch (err) {
        console.error("Error during Telegram auth with backend:", err);
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        alert(`Error: ${errorMessage}`); // Consider a less intrusive error display
      } finally {
        setIsLoading(false);
      }
    };

    // Assign the handler to a global callback function
    window.onTelegramAuthCallback = handleTelegramLogin;

    // Cleanup
    return () => {
      delete window.onTelegramAuthCallback;
    };
  }, [router, setIsLoading, setError, setSupabaseUser]);

  return (
    <>
      <div id="telegram-login-container">
        <Script
          src="https://telegram.org/js/telegram-widget.js?22"
          strategy="afterInteractive" // Load after the page becomes interactive
          data-telegram-login="OpenNews_bot"
          data-size="large"
          data-onauth="triggerReactAuth(user)"
          data-request-access="write"
          onLoad={() => {
            console.log("Telegram widget script loaded successfully.");
          }}
          onError={(e) => {
            console.error("Error loading Telegram widget script:", e);
          }}
        />
      </div>
      {isLoading && <p>Logging in with Telegram...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {supabaseUser && (
        <div style={{ marginTop: "10px", fontSize: "0.8em" }}>
          <p>Supabase User ID: {supabaseUser.id}</p>
          {supabaseUser.user_metadata?.telegram_username && (
            <p>Logged in as: @{supabaseUser.user_metadata.telegram_username}</p>
          )}
        </div>
      )}
    </>
  );
};

export default TelegramLoginButton;
