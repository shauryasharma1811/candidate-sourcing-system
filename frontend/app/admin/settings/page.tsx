"use client";

import { KeyRound, Mail, Shield, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { authService } from "@/services/auth-service";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePasswordReset() {
    if (!user?.email) return;
    setIsSending(true);
    setError(null);
    try {
      await authService.forgotPassword(user.email);
      setSent(true);
    } catch {
      setError("Something went wrong sending the reset link. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">Your admin account details.</p>
      </div>

      <div className="max-w-xl space-y-6">
        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Profile</h2>
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">
                  {user ? `${user.first_name} ${user.last_name}` : "—"}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{user?.email ?? "—"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs text-gray-500">Role</dt>
                <dd className="text-sm text-gray-900">{user?.role ?? "—"}</dd>
              </div>
            </div>
          </dl>
        </section>

        <section className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Password</h2>
          <p className="mb-4 text-sm text-gray-600">
            We&apos;ll email a reset link to <span className="font-medium">{user?.email}</span>.
          </p>
          <Button type="button" variant="secondary" onClick={handlePasswordReset} disabled={isSending || sent}>
            <KeyRound className="h-4 w-4" />
            {sent ? "Reset link sent" : isSending ? "Sending…" : "Send password reset link"}
          </Button>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </section>
      </div>
    </div>
  );
}
