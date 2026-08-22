"use client";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ProtectedRoute } from "@/features/auth/protected-route";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["Admin"]}>
      <div className="flex min-h-screen bg-background md:flex-row">
        <AdminSidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
