"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn, signUp } from "@/lib/auth-client";
import { toast } from "sonner";

interface AuthFormProps {
  onSuccess?: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await signIn.email({
          email,
          password,
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("登入成功");
          onSuccess?.();
        }
      } else {
        const { data, error } = await signUp.email({
          email,
          password,
          name,
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success("註冊成功");
          onSuccess?.();
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("發生錯誤，請重試");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg border shadow">
      <h2 className="text-2xl font-bold text-center mb-6">
        {isLogin ? "登入" : "註冊"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              姓名
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required={!isLogin}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            密碼
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "處理中..." : isLogin ? "登入" : "註冊"}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setIsLogin(!isLogin)}
          className="text-blue-600 hover:underline"
        >
          {isLogin ? "還沒有帳號？註冊" : "已有帳號？登入"}
        </button>
      </div>
    </div>
  );
}