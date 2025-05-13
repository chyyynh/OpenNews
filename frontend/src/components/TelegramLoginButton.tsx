"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js"; // Import Supabase client

// Initialize Supabase client (consider moving to a shared lib if not already)
// This is for potential use with setSession if API returns full session data.
// For now, it's not strictly used in this component's current logic.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  const scriptContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any | null>(null); // To store Supabase user info

  useEffect(() => {
    // Define the callback function and attach it to the window object
    window.onTelegramAuth = async (telegramUser: TelegramUserData) => {
      setIsLoading(true);
      setError(null);
      setSupabaseUser(null);
      console.log("Telegram user data received:", telegramUser);

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

        console.log("Supabase auth successful:", result);
        setSupabaseUser(result.user);
        alert(
          `Successfully authenticated with Supabase via Telegram! Supabase User ID: ${result.user?.id}`
        );
        // TODO: If API returned session tokens (access_token, refresh_token), use them:
        // await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
        // And then perhaps redirect or update UI state.
      } catch (err) {
        console.error("Error during Telegram auth with backend:", err);
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred";
        setError(errorMessage);
        alert(`Error: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", "OpenNews_bot"); // Use the provided bot name
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    // Append the script to the container div
    if (scriptContainerRef.current) {
      scriptContainerRef.current.appendChild(script);
    }

    // Cleanup function to remove the script and the callback
    return () => {
      if (scriptContainerRef.current) {
        scriptContainerRef.current.innerHTML = ""; // Remove the script and button
      }
      delete window.onTelegramAuth;
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount

  return (
    <div>
      <div ref={scriptContainerRef}></div>
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
    </div>
  );
};

export default TelegramLoginButton;
