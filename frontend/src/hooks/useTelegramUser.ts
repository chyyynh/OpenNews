"use client";

import { useEffect, useState } from "react";
import type { TelegramUser } from "@/types";

export function useTelegramUser() {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;

      // Signal to Telegram that the Mini App is ready
      webApp.ready();

      // Get user info
      if (webApp.initDataUnsafe?.user) {
        const tgUser = webApp.initDataUnsafe.user;
        setUser({
          id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
          auth_date: Math.floor(Date.now() / 1000),
          hash: "from_webapp",
        });
      } else {
        console.warn("No user data available in WebApp.initDataUnsafe");

        // For development outside of Telegram
        if (process.env.NODE_ENV === "development") {
          console.log("Setting mock user for development");
          setUser({
            id: 12345,
            first_name: "Dev",
            last_name: "User",
            username: "devuser",
            auth_date: Math.floor(Date.now() / 1000),
            hash: "dev_mode",
          });
        }
      }

      // Apply Telegram theme colors
      if (webApp.themeParams) {
        document.documentElement.style.setProperty(
          "--tg-theme-bg-color",
          webApp.themeParams.bg_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-text-color",
          webApp.themeParams.text_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-hint-color",
          webApp.themeParams.hint_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-link-color",
          webApp.themeParams.link_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-button-color",
          webApp.themeParams.button_color || ""
        );
        document.documentElement.style.setProperty(
          "--tg-theme-button-text-color",
          webApp.themeParams.button_text_color || ""
        );
      }
    } else {
      console.warn(
        "Telegram WebApp is not available. Are you running outside of Telegram?"
      );

      // For development outside of Telegram
      if (process.env.NODE_ENV === "development") {
        console.log("Setting mock user for development");
        setUser({
          id: 12345,
          first_name: "Dev",
          last_name: "User",
          username: "devuser",
          auth_date: Math.floor(Date.now() / 1000),
          hash: "dev_mode",
        });
      }
    }

    setIsLoading(false);
  }, []);

  return { user, isLoading };
}
