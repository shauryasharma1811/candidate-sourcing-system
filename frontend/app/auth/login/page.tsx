"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { FormField, inputClass } from "@/components/ui/form-field";
import { useAuth } from "@/features/auth/auth-context";
import { ApiRequestError } from "@/lib/api-client";
import { consumeIntendedJobId } from "@/lib/session";

function CandidateLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginCandidate } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Prefer a job the user was mid-application for; fall back to `next` query param
      const intendedJobId = consumeIntendedJobId();
      const redirectTo = await loginCandidate(email, password, intendedJobId);

      const next = searchParams.get("next");
      router.push(redirectTo ?? next ?? "/jobs");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">Candidate Login</h1>

      <form onSubmit={handleSubmit}>
        <FormField label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FormField>

        <FormField label="Password">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </FormField>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex justify-between text-sm">
        <Link href="/auth/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
        <Link href="/auth/register" className="text-primary hover:underline">
          Create an account
        </Link>
      </div>
    </main>
  );
}

export default function CandidateLoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <CandidateLoginForm />
    </Suspense>
  );
}
