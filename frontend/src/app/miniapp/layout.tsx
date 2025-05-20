import type React from "react";
import "./globals.css";

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script src="https://telegram.org/js/telegram-web-app.js?57"></script>
      {children}
    </>
  );
}
