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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <SignUp />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            已經有帳戶？{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              立即登入
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