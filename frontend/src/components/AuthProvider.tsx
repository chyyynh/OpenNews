"use client";

import { useSession } from "@/lib/auth-client";
import { ReactNode } from "react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  return <>{children}</>;
}