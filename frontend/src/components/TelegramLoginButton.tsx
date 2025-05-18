// component/TelegramLoginButton.tsx
"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: boolean;
  usePic?: boolean;
  lang?: string;
}

export default function TelegramLoginButton({
  botName,
  onAuth,
  buttonSize = "medium",
  cornerRadius = 4,
  requestAccess = true,
  usePic = true,
  lang = "en",
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Define the callback function that Telegram will call
    window.onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };

    return () => {
      // Clean up
      delete window.onTelegramAuth;
    };
  }, [onAuth]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-widget.js?22"
        strategy="lazyOnload"
        onLoad={() => {
          if (containerRef.current) {
            // Clear previous widget if any
            containerRef.current.innerHTML = "";

            // Create the Telegram login button
            const script = document.createElement("script");
            script.async = true;
            script.src = "https://telegram.org/js/telegram-widget.js?22";
            script.setAttribute("data-telegram-login", botName);
            script.setAttribute("data-size", buttonSize);
            script.setAttribute("data-radius", cornerRadius.toString());
            script.setAttribute(
              "data-request-access",
              requestAccess ? "write" : "read"
            );
            script.setAttribute("data-userpic", usePic ? "true" : "false");
            script.setAttribute("data-lang", lang);
            script.setAttribute("data-onauth", "onTelegramAuth(user)");

            containerRef.current.appendChild(script);
          }
        }}
      />
      <div ref={containerRef} className="telegram-login-container"></div>
    </>
  );
}

// Add the global type definition for the Telegram callback
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}
