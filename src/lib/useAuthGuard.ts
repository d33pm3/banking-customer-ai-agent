import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/domain/store";

export function useAuthGuard() {
  const { user, ready } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !user) navigate({ to: "/" });
  }, [ready, user, navigate]);
  return { user, ready };
}
