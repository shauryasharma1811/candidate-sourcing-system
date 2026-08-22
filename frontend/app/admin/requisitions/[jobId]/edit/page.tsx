"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { JobForm, JobFormValues } from "@/components/admin/job-form";
import { ApiRequestError } from "@/lib/api-client";
import { requisitionService } from "@/services/requisition-service";
import { RequisitionDetail } from "@/types";

export default function EditRequisitionPage() {
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [requisition, setRequisition] = useState<RequisitionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    requisitionService
      .get(jobId)
      .then((data) => {
        if (!cancelled) setRequisition(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiRequestError ? err.message : "Couldn't load this requisition.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function handleSubmit(values: JobFormValues, publish: boolean) {
    setServerError(null);
    setSubmitting(true);
    try {
      await requisitionService.update(jobId, { ...values, publish });
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
        <h1 className="text-2xl font-semibold text-foreground">Edit Requisition</h1>
        <p className="mt-1 text-sm text-muted">Update the details below.</p>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {loadError && <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>}

      {requisition && (
        <JobForm
          initialValues={{
            title: requisition.title,
            department: requisition.department,
            location: requisition.location,
            employment_type: requisition.employment_type,
            experience_required: requisition.experience_required,
            openings: requisition.openings,
            hiring_manager: requisition.hiring_manager,
            description: requisition.description,
            max_salary: requisition.max_salary,
            hiring_completion_date: requisition.hiring_completion_date,
          }}
          requisitionCode={requisition.requisition_code}
          status={requisition.status}
          applicationCount={requisition.application_count}
          submitting={submitting}
          serverError={serverError}
          onCancel={() => router.push("/admin/requisitions")}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
