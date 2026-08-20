"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField, inputClass } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { EmploymentType, JobStatus, RequisitionFormInput } from "@/types";

const EMPLOYMENT_TYPES: EmploymentType[] = ["Full-Time", "Part-Time", "Contract", "Internship"];

export type JobFormValues = Omit<RequisitionFormInput, "publish">;

const EMPTY_VALUES: JobFormValues = {
  title: "",
  department: "",
  location: "",
  employment_type: "Full-Time",
  experience_required: "",
  openings: 1,
  hiring_manager: "",
  description: "",
  max_salary: null,
  hiring_completion_date: "",
};

export interface JobFormProps {
  /** Existing requisition values when editing; omitted for a brand-new draft. */
  initialValues?: Partial<JobFormValues>;
  /** Auto-generated requisition code — only known once a Draft has been created. */
  requisitionCode?: string;
  /** Current lifecycle status — controls which action buttons make sense. */
  status?: JobStatus;
  submitting?: boolean;
  serverError?: string | null;
  onCancel: () => void;
  /** publish=false -> Save Draft / Save Changes; publish=true -> Publish. */
  onSubmit: (values: JobFormValues, publish: boolean) => void | Promise<void>;
}

type Errors = Partial<Record<keyof JobFormValues, string>>;

export function JobForm({
  initialValues,
  requisitionCode,
  status,
  submitting = false,
  serverError,
  onCancel,
  onSubmit,
}: JobFormProps) {
  const [values, setValues] = useState<JobFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [errors, setErrors] = useState<Errors>({});
  const [pendingAction, setPendingAction] = useState<"draft" | "publish" | null>(null);

  function update<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function validate(): Errors {
    const next: Errors = {};
    if (!values.title.trim()) next.title = "Job title is required.";
    else if (values.title.length > 150) next.title = "Job title must be 150 characters or fewer.";

    if (!values.department.trim()) next.department = "Department is required.";
    if (!values.location.trim()) next.location = "Location is required.";
    if (!values.hiring_manager.trim()) next.hiring_manager = "Hiring manager is required.";

    if (!values.openings || values.openings < 1) next.openings = "Openings must be at least 1.";
    else if (values.openings > 999) next.openings = "Openings must be 999 or fewer.";

    if (values.max_salary !== null && values.max_salary !== undefined && values.max_salary < 0) {
      next.max_salary = "Maximum salary can't be negative.";
    }

    if (values.hiring_completion_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(values.hiring_completion_date) < today) {
        next.hiring_completion_date = "Hiring completion date can't be in the past.";
      }
    }

    return next;
  }

  async function handleAction(publish: boolean) {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setPendingAction(publish ? "publish" : "draft");
    try {
      await onSubmit(values, publish);
    } finally {
      setPendingAction(null);
    }
  }

  const isClosed = status === "Closed";
  const isPublished = status === "Published";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleAction(false);
      }}
      className="max-w-3xl"
    >
      {requisitionCode && (
        <div className="mb-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200">
          Requisition ID: <span className="font-medium text-gray-900">{requisitionCode}</span>
        </div>
      )}

      {!requisitionCode && (
        <p className="mb-4 text-sm text-gray-500">A requisition ID will be generated automatically on save.</p>
      )}

      {serverError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{serverError}</div>
      )}

      {isClosed && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
          This requisition is closed and can no longer be edited.
        </div>
      )}

      <fieldset disabled={isClosed || submitting} className="disabled:opacity-60">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <FormField label="Job Title" error={errors.title}>
            <input
              className={inputClass}
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              maxLength={150}
              required
            />
          </FormField>

          <FormField label="Department" error={errors.department}>
            <input
              className={inputClass}
              value={values.department}
              onChange={(e) => update("department", e.target.value)}
              maxLength={100}
              required
            />
          </FormField>

          <FormField label="Location" error={errors.location}>
            <input
              className={inputClass}
              value={values.location}
              onChange={(e) => update("location", e.target.value)}
              maxLength={150}
              required
            />
          </FormField>

          <FormField label="Employment Type" error={errors.employment_type}>
            <Select
              label=""
              className="w-full"
              value={values.employment_type}
              onChange={(e) => update("employment_type", e.target.value as EmploymentType)}
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Experience" error={errors.experience_required}>
            <input
              className={inputClass}
              value={values.experience_required ?? ""}
              onChange={(e) => update("experience_required", e.target.value)}
              placeholder="e.g. 2-4 years"
              maxLength={50}
            />
          </FormField>

          <FormField label="Openings" error={errors.openings}>
            <input
              type="number"
              min={1}
              max={999}
              className={inputClass}
              value={values.openings}
              onChange={(e) => update("openings", Number(e.target.value))}
              required
            />
          </FormField>

          <FormField label="Hiring Manager" error={errors.hiring_manager}>
            <input
              className={inputClass}
              value={values.hiring_manager}
              onChange={(e) => update("hiring_manager", e.target.value)}
              maxLength={150}
              required
            />
          </FormField>

          <FormField label="Maximum Salary Budget" error={errors.max_salary}>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={values.max_salary ?? ""}
              onChange={(e) => update("max_salary", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="Optional"
            />
          </FormField>

          <FormField label="Hiring Completion Date" error={errors.hiring_completion_date}>
            <input
              type="date"
              className={inputClass}
              value={values.hiring_completion_date ?? ""}
              onChange={(e) => update("hiring_completion_date", e.target.value || null)}
            />
          </FormField>
        </div>

        <FormField label="Job Description" error={errors.description}>
          <textarea
            className={`${inputClass} min-h-[140px] resize-y`}
            value={values.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Role summary, responsibilities, requirements…"
          />
        </FormField>
      </fieldset>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>

        {!isClosed && !isPublished && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleAction(false)}
            disabled={submitting}
          >
            {pendingAction === "draft" && submitting ? "Saving…" : "Save Draft"}
          </Button>
        )}

        {isPublished && (
          <Button type="button" variant="secondary" onClick={() => handleAction(false)} disabled={submitting}>
            {pendingAction === "draft" && submitting ? "Saving…" : "Save Changes"}
          </Button>
        )}

        {!isClosed && !isPublished && (
          <Button type="button" onClick={() => handleAction(true)} disabled={submitting}>
            {pendingAction === "publish" && submitting ? "Publishing…" : "Publish"}
          </Button>
        )}
      </div>
    </form>
  );
}
