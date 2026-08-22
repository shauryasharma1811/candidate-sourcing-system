"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { SiteHeader } from "@/components/ui/site-header";
import { ProtectedRoute } from "@/features/auth/protected-route";
import { ApplyWizard } from "@/features/apply/apply-wizard";

function ApplyContent({ jobId }: { jobId: string }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href={`/jobs/${jobId}`} className="text-sm font-medium text-primary hover:text-primary">
          ← Back to job details
        </Link>

        <div className="mt-6">
          <ApplyWizard jobId={jobId} />
        </div>
      </div>
    </div>
  );
}

export default function JobApplyPage() {
  const { jobId } = useParams<{ jobId: string }>();
  return (
    <ProtectedRoute allowedRoles={["Candidate"]} intendedJobId={jobId}>
      <ApplyContent jobId={jobId} />
    </ProtectedRoute>
  );
}
