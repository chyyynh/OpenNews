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
      console.log('Telegram auth callback received:', user);
      onAuth(user);
    };

    return () => {
      // Clean up
      delete window.onTelegramAuth;
    };
  }, [onAuth]);

  return (
    <div ref={containerRef} className="telegram-login-container">
      {/* Debug info */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Debug: Bot={botName}, Domain={typeof window !== 'undefined' ? window.location.origin : 'unknown'}
      </div>
      
      <Script
        async
        src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login={botName}
        data-size={buttonSize}
        data-radius={cornerRadius.toString()}
        data-request-access={requestAccess ? "write" : "read"}
        data-userpic={usePic ? "true" : "false"}
        data-lang={lang}
        data-onauth="onTelegramAuth(user)"
        onLoad={() => {
          console.log('✅ Telegram widget loaded successfully');
          console.log('Bot name:', botName);
          console.log('Current domain:', window.location.origin);
          console.log('Callback function exists:', typeof window.onTelegramAuth);
        }}
        onError={(e) => {
          console.error('❌ Failed to load Telegram widget:', e);
        }}
      />
    </div>
  );
}

// Add the global type definition for the Telegram callback
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}
