"use client";

import Image from "next/image";
import { UserIcon } from "lucide-react";
import type { TelegramUser } from "@/types";

interface UserDisplayProps {
  user: TelegramUser | null;
}

export function UserDisplay({ user }: UserDisplayProps) {
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {user.photo_url ? (
        <Image
          src={user.photo_url}
          alt={user.first_name}
          width={24}
          height={24}
          className="h-6 w-6 rounded-full"
        />
      ) : (
        <UserIcon className="h-4 w-4" />
      )}
      <span className="text-sm font-medium">
        {user.username ||
          `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`}
      </span>
    </div>
  );
}
