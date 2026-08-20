"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { JobForm, JobFormValues } from "@/components/admin/job-form";
import { ApiRequestError } from "@/lib/api-client";
import { requisitionService } from "@/services/requisition-service";

export default function NewRequisitionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: JobFormValues, publish: boolean) {
    setServerError(null);
    setSubmitting(true);
    try {
      await requisitionService.create({ ...values, publish });
      router.push("/admin/requisitions");
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Couldn't save the requisition. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">New Requisition</h1>
        <p className="mt-1 text-sm text-gray-600">Save as a draft, or publish it to the careers site immediately.</p>
      </div>

      <JobForm
        submitting={submitting}
        serverError={serverError}
        onCancel={() => router.push("/admin/requisitions")}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
