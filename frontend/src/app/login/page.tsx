"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import SignIn from "@/components/auth/sign-in";

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // Redirect if already logged in
  useEffect(() => {
    if (session?.user) {
      router.push("/");
    }
  }, [session, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <SignIn />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            還沒有帳戶？{" "}
            <Link
              href="/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              註冊新帳戶
            </Link>
          </p>
          <Link
            href="/"
            className="text-indigo-600 hover:text-indigo-500 text-sm block mt-2"
          >
            返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}