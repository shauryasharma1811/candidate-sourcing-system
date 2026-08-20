"use client";

import { useParams } from "next/navigation";

import { useAuth } from "@/features/auth/auth-context";
import { ProtectedRoute } from "@/features/auth/protected-route";

function ApplyContent() {
  const { user } = useAuth();
  const { jobId } = useParams<{ jobId: string }>();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Apply for job {jobId}</h1>
      <p className="mt-2 text-gray-600">Welcome back, {user?.first_name}. The multi-step application form (Sprint 4) goes here.</p>
    </main>
  );
}

export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  return (
    <ProtectedRoute allowedRoles={["Candidate"]} intendedJobId={jobId}>
      <ApplyContent />
    </ProtectedRoute>
  );
}
