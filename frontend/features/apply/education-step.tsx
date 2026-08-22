"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputClass } from "@/components/ui/form-field";
import { ApiRequestError } from "@/lib/api-client";
import { candidateService } from "@/services/candidate-service";
import { EducationEntry, EducationFormInput } from "@/types";

// ---------------------------------------------------------------------
// Zod schema — matches BRD repeatable-education rules: Degree and
// Institution required, Passing Year cannot be in the future, CGPA on
// a 0–10 scale (backend enforces the same range).
// ---------------------------------------------------------------------
const CURRENT_YEAR = new Date().getFullYear();

const educationSchema = z.object({
  institution: z
    .string()
    .trim()
    .min(1, "Institution is required.")
    .max(150, "Institution must be 150 characters or fewer."),
  degree: z
    .string()
    .trim()
    .min(1, "Degree is required.")
    .max(150, "Degree must be 150 characters or fewer."),
  passing_year: z
    .number({ invalid_type_error: "Enter a valid passing year." })
    .int("Enter a valid passing year.")
    .min(1950, "Enter a valid passing year.")
    .max(CURRENT_YEAR, "Passing year cannot be in the future."),
  cgpa: z
    .number({ invalid_type_error: "Enter a valid CGPA." })
    .min(0, "CGPA must be between 0 and 10.")
    .max(10, "CGPA must be between 0 and 10."),
});

type EducationFormValues = z.infer<typeof educationSchema>;

const EMPTY: EducationFormValues = {
  institution: "",
  degree: "",
  passing_year: CURRENT_YEAR,
  cgpa: 0,
};

export function EducationStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [entries, setEntries] = useState<EducationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EducationEntry | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EducationFormValues>({
    resolver: zodResolver(educationSchema),
    defaultValues: EMPTY,
  });

  function loadEntries() {
    setIsLoading(true);
    candidateService
      .listEducation()
      .then(setEntries)
      .catch(() => setLoadError("Couldn't load your education history."))
      .finally(() => setIsLoading(false));
  }

  useEffect(loadEntries, []);

  function startAdd() {
    setEditingId(null);
    reset(EMPTY);
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(entry: EducationEntry) {
    setEditingId(entry.id);
    reset({
      institution: entry.institution,
      degree: entry.degree,
      passing_year: entry.passing_year,
      cgpa: Number(entry.cgpa),
    });
    setFormError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setEditingId(null);
    reset(EMPTY);
    setFormError(null);
    setShowForm(false);
  }

  async function onSubmit(values: EducationFormValues) {
    const payload: EducationFormInput = {
      institution: values.institution.trim(),
      degree: values.degree.trim(),
      passing_year: values.passing_year,
      cgpa: values.cgpa,
    };

    setFormError(null);
    setSaving(true);
    try {
      if (editingId) {
        await candidateService.updateEducation(editingId, payload);
      } else {
        await candidateService.addEducation(payload);
      }
      cancelForm();
      loadEntries();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Couldn't save this entry. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await candidateService.deleteEducation(deleteTarget.id);
      setDeleteTarget(null);
      loadEntries();
    } catch {
      setDeleteTarget(null);
    }
  }

  function handleContinue() {
    if (entries.length === 0) {
      setContinueError("Add at least one education entry to continue.");
      return;
    }
    onNext();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Education</h2>
      <p className="mt-1 text-sm text-muted">Add at least one education entry. You can add as many as you need.</p>

      {loadError && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{loadError}</p>}

      {isLoading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : (
        <>
          {entries.length > 0 && (
            <ul className="mt-4 space-y-2">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-background px-4 py-3 ring-1 ring-border"
                >
                  <div className="flex items-start gap-3">
                    <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.degree}</p>
                      <p className="text-sm text-muted">{entry.institution}</p>
                      <p className="text-xs text-muted">
                        Passing Year: {entry.passing_year} · CGPA: {entry.cgpa}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(entry)}
                      className="rounded p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                      title="Edit"
                    aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(entry)}
                      className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400"
                      title="Remove"
                    aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={startAdd}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-muted hover:border-blue-400 hover:bg-primary-soft/60 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Add education entry
            </button>
          ) : (
            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-4 rounded-2xl border border-dashed border-border p-4"
            >
              <p className="mb-3 text-sm font-medium text-foreground">{editingId ? "Edit entry" : "Add education"}</p>

              {formError && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{formError}</p>}

              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <FormField label="Degree" error={errors.degree?.message}>
                  <input className={inputClass} maxLength={150} {...register("degree")} />
                </FormField>
                <FormField label="Institution" error={errors.institution?.message}>
                  <input className={inputClass} maxLength={150} {...register("institution")} />
                </FormField>
                <FormField label="Passing Year" error={errors.passing_year?.message}>
                  <input
                    type="number"
                    className={inputClass}
                    min={1950}
                    max={CURRENT_YEAR}
                    {...register("passing_year", { valueAsNumber: true })}
                  />
                </FormField>
                <FormField label="CGPA" error={errors.cgpa?.message}>
                  <input
                    type="number"
                    step="0.01"
                    className={inputClass}
                    min={0}
                    max={10}
                    placeholder="0.00 – 10.00"
                    {...register("cgpa", { valueAsNumber: true })}
                  />
                </FormField>
              </div>

              <div className="mt-3 flex gap-2">
                <Button type="submit" variant="secondary" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Update Entry" : "Add Entry"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelForm} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </>
      )}

      {continueError && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{continueError}</p>}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={handleContinue}>
          Continue
        </Button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove this entry?"
        description={deleteTarget ? `"${deleteTarget.degree}" at ${deleteTarget.institution} will be removed.` : ""}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
