"use client";

import Image from "next/image";
import { LogOut, Settings } from "lucide-react";
import { useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { toast } from "sonner";
import type { User } from "@/lib/auth";

interface UserMenuProps {
  user: User;
  isKolModeEnabled: boolean;
  onKolModeToggle: (enabled: boolean) => void;
}

export const UserMenu = memo(function UserMenu({ 
  user, 
  isKolModeEnabled, 
  onKolModeToggle 
}: UserMenuProps) {
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      toast.success("已成功登出");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("登出失敗，請重試");
    }
  }, []);

  const handleKolModeToggle = useCallback((checked: boolean) => {
    onKolModeToggle(checked);
    toast.success(checked ? "KOL Mode 已開啟" : "KOL Mode 已關閉");
  }, [onKolModeToggle]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            <span>{user.name || user.email}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="text-sm text-gray-500" disabled>
          {user.email}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={isKolModeEnabled}
          onCheckedChange={handleKolModeToggle}
        >
          <Settings className="h-4 w-4 mr-2" />
          KOL Mode
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          登出
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});