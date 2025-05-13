"use client";

import React from "react";
import TelegramLoginButton from "@/components/TelegramLoginButton";

const LoginPage: React.FC = () => {
  // This is a placeholder for a more robust auth check if needed on the login page itself
  // For example, if already logged in, redirect to home.
  // For now, we assume if you're on /login, you need to log in.

  // We'll modify TelegramLoginButton to handle redirection on successful login,
  // or pass a callback to it. For simplicity, let's plan to modify TelegramLoginButton.

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "2em", marginBottom: "20px" }}>Login / Sign Up</h1>
      <p style={{ marginBottom: "30px", color: "#555" }}>
        Please log in using Telegram to continue.
      </p>
      <TelegramLoginButton />
      {/* You could add other login methods here in the future */}
    </div>
  );
};

export default LoginPage;
