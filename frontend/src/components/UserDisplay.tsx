"use client";

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
        <img
          src={user.photo_url || "/placeholder.svg"}
          alt={user.first_name}
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
