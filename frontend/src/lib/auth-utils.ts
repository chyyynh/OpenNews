import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export function useAuthCheck() {
  const router = useRouter();
  const { data: session } = useSession();

  const requireAuth = (callback?: () => void) => {
    if (!session?.user) {
      router.push("/login");
      return false;
    }
    callback?.();
    return true;
  };

  const handleAuthError = (response: Response, data: any) => {
    if (response.status === 401 && data.requiresAuth) {
      router.push("/login");
      return true;
    }
    return false;
  };

  return {
    isAuthenticated: !!session?.user,
    user: session?.user,
    requireAuth,
    handleAuthError,
  };
}