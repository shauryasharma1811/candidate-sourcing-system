"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormField, inputClass } from "@/components/ui/form-field";
import { useAuth } from "@/features/auth/auth-context";
import { ApiRequestError } from "@/lib/api-client";
import { authService } from "@/services/auth-service";
import { saveTokens } from "@/lib/session";
import { consumeIntendedJobId } from "@/lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const { refreshProfile } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    mobile: "",
    location: "",
    consent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.consent) {
      setError("Please provide consent to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const tokens = await authService.registerCandidate(form);
      saveTokens(tokens.access_token, tokens.refresh_token);
      await refreshProfile();

      const intendedJobId = consumeIntendedJobId();
      router.push(intendedJobId ? `/jobs/${intendedJobId}/apply` : "/jobs");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name">
            <input className={inputClass} value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required maxLength={50} />
          </FormField>
          <FormField label="Last name">
            <input className={inputClass} value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required maxLength={50} />
          </FormField>
        </div>

        <FormField label="Email">
          <input type="email" className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} required autoComplete="email" />
        </FormField>

        <FormField label="Mobile">
          <input className={inputClass} value={form.mobile} onChange={(e) => update("mobile", e.target.value)} required placeholder="+1234567890" />
        </FormField>

        <FormField label="Location">
          <input className={inputClass} value={form.location} onChange={(e) => update("location", e.target.value)} />
        </FormField>

        <FormField label="Password">
          <input
            type="password"
            className={inputClass}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <p className="mt-1 text-xs text-muted">At least 8 characters, with upper, lower, and a number.</p>
        </FormField>

        <label className="mb-4 flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => update("consent", e.target.checked)} />
          I consent to my information being used to process my application(s).
        </label>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
