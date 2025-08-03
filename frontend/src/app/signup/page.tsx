"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import SignUp from "@/components/auth/sign-up";

export default function SignupPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // Redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      router.push("/");
    }
  }, [session, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ON</span>
            </div>
            <span className="text-xl font-bold text-gray-900">OpenNews</span>
          </Link>
          <Link
            href="/"
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            ← 返回首頁
          </Link>
        </div>

        {/* Main Content */}
        <div className="flex items-center justify-center min-h-screen lg:min-h-[calc(100vh-200px)] -mt-20 lg:mt-0">
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Marketing Content (Hidden on mobile) */}
            <div className="hidden lg:block space-y-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  加入 OpenNews 社群
                </h1>
                <p className="text-xl text-gray-600 mb-6">
                  開始您的 AI 新聞聚合體驗
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">免費使用</h3>
                    <p className="text-gray-600 text-sm">完全免費的新聞聚合服務</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">即時更新</h3>
                    <p className="text-gray-600 text-sm">24/7 自動抓取最新新聞內容</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">智能分析</h3>
                    <p className="text-gray-600 text-sm">AI 驅動的標籤分類和關鍵字提取</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">社交整合</h3>
                    <p className="text-gray-600 text-sm">快速分享到 Twitter 和其他平台</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Signup Form */}
            <div className="w-full max-w-md mx-auto lg:mx-0">
              <SignUp />
              <div className="text-center mt-6">
                <p className="text-sm text-gray-600">
                  已經有帳戶？{" "}
                  <Link
                    href="/login"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    立即登入
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}