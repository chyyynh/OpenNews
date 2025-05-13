"use client";
import Script from "next/script";
import React from "react";

export default function TestPage() {
  return (
    <>
      <h1>Test Telegram Login</h1>
      <Script
        src="https://telegram.org/js/telegram-widget.js?22"
        strategy="afterInteractive"
        data-telegram-login="OpenNews_bot"
        data-size="large"
        data-userpic="true"
        data-request-access="write"
        data-onauth="console.log(user)"
        onLoad={() => console.log("Telegram Widget loaded")}
      />
    </>
  );
}
