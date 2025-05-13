// component/TelegramLoginButton.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation"; // For navigation after login
import { toast } from "sonner";
import type { TelegramUserAuth } from "../types/telegram"; // Adjust path if necessary

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUserAuth) => void;
  }
}

const TelegramLoginButton: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
      console.error("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not set.");
      setError(
        "Telegram login is not configured correctly. (Admin: Check bot username ENV var)"
      );
      return;
    }

    // Define the callback function that Telegram will call
    window.onTelegramAuth = async (user: TelegramUserAuth) => {
      setIsLoading(true);
      setError(null);
      console.log("Telegram user data received on client:", user);
      try {
        const response = await fetch("/api/auth/telegram/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Verification failed. Please try again."
          );
        }

        toast.success(result.message || "Login successful!");
        // TODO: Store session/user context here if needed immediately on client
        // For now, just redirecting.
        // We might want to redirect to where the user was trying to go, or a default like /kol-admin
        router.push("/"); // Redirect to KOL admin page after successful login
      } catch (err: unknown) {
        console.error("Error during Telegram auth verification:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during login.";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    // Create the script element
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    // script.setAttribute('data-radius', '10'); // Example: Customize button appearance
    script.setAttribute("data-onauth", "onTelegramAuth(user)"); // Call our window function
    // script.setAttribute('data-request-access', 'write'); // To request permission to write to the user

    if (scriptContainerRef.current) {
      scriptContainerRef.current.appendChild(script);
    }

    // Cleanup function to remove the script and window function when the component unmounts
    return () => {
      if (scriptContainerRef.current) {
        // Find and remove the iframe Telegram injects, if any
        const iframe = scriptContainerRef.current.querySelector("iframe");
        if (iframe) {
          scriptContainerRef.current.removeChild(iframe);
        }
        // Remove the script itself, though the iframe is the main visible part
        if (script.parentNode === scriptContainerRef.current) {
          scriptContainerRef.current.removeChild(script);
        }
      }
      delete window.onTelegramAuth;
    };
  }, [router]); // Add router to dependency array if used in cleanup, though not strictly needed here

  return (
    <div className="flex flex-col items-center">
      {isLoading && (
        <p className="text-sm text-muted-foreground">Processing login...</p>
      )}
      {error && <p className="text-sm text-destructive py-2">Error: {error}</p>}
      {/* The Telegram script will inject the button into this div (or based on its own logic) */}
      {/* We use a ref to ensure we control where it attempts to inject and can clean it up */}
      <div ref={scriptContainerRef} id="telegram-login-container"></div>
    </div>
  );
};

export default TelegramLoginButton;
