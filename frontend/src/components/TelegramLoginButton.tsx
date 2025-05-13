// component/TelegramLoginButton.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // Import for redirection
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client (consider moving to a shared lib if not already)
// This is for potential use with setSession if API returns full session data.
// For now, it's not strictly used in this component's current logic.
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
    (window as any).onTelegramAuthCallback = handleTelegramLogin;

    // Cleanup
    return () => {
      delete (window as any).onTelegramAuthCallback;
    };
  }, [router, setIsLoading, setError, setSupabaseUser]);

  return (
    <>
      {/* This div is where the Telegram script will render the button */}
      <div>
        <script
          async
          src="https://telegram.org/js/telegram-widget.js?22"
          data-telegram-login="OpenNews_bot"
          data-size="large"
          data-onauth="triggerReactAuth(user)" // Calls our new global intermediary
          data-request-access="write"
        ></script>
      </div>
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `
            function triggerReactAuth(user) {
              // This function is called by the Telegram widget
              // console.log('Telegram user data received by triggerReactAuth:', user);
              // alert('Logged in as ' + user.first_name + ' ' + user.last_name + ' (' + user.id + (user.username ? ', @' + user.username : '') + ')');
              if (window.onTelegramAuthCallback) {
                window.onTelegramAuthCallback(user);
              } else {
                console.error('onTelegramAuthCallback is not defined on window. React component might not be mounted or callback not set.');
              }
            }
          `,
        }}
      ></script>
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
