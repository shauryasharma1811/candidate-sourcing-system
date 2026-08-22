"use client";

/**
 * Wrap any page/layout that requires auth. If the user is not logged in,
 * we store the current path (e.g. the job apply page) and send them to
 * /auth/login. After a successful login, auth-context reads that stored
 * path (or the intended_job_id returned by the login API) and forwards
 * the user back to where they were headed.
 */
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/auth-context";
import { setIntendedJobId } from "@/lib/session";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<"Admin" | "Candidate">;
  /** If this page is a job-apply flow, pass the job id so login can return here */
  intendedJobId?: string;
}

export function ProtectedRoute({ children, allowedRoles, intendedJobId }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      if (intendedJobId) setIntendedJobId(intendedJobId);
      const loginPath = allowedRoles?.includes("Admin") && !allowedRoles.includes("Candidate")
        ? "/auth/admin/login"
        : "/auth/login";
      router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      router.replace("/"); // authenticated, but wrong role — bounce home
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, intendedJobId, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center p-16 text-muted">
        Checking your session…
      </div>
    );
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
