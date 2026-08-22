"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField, inputClass } from "@/components/ui/form-field";
import { ApiRequestError } from "@/lib/api-client";
import { candidateService } from "@/services/candidate-service";
import { ExperienceEntry, ExperienceFormInput } from "@/types";

// ---------------------------------------------------------------------
// Zod schema with CONDITIONAL validation (BRD: "Experience end >= start
// unless current"): End Date is required and must be on/after Start
// Date UNLESS "Currently Working" is checked, in which case End Date
// must be empty.
// ---------------------------------------------------------------------
const experienceSchema = z
  .object({
    company: z.string().trim().min(1, "Company is required.").max(150, "Company must be 150 characters or fewer."),
    title: z.string().trim().min(1, "Job title is required.").max(150, "Job title must be 150 characters or fewer."),
    start_date: z
      .string()
      .min(1, "Start date is required.")
      .refine((v) => new Date(v) <= new Date(), { message: "Start date can't be in the future." }),
    currently_working: z.boolean(),
    end_date: z.string().nullable(),
    responsibilities: z.string().max(2000, "Keep responsibilities under 2000 characters.").nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.currently_working) {
      if (values.end_date) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "Clear the end date for a current role." });
      }
      return;
    }
    if (!values.end_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "End date is required unless this is your current role." });
      return;
    }
    if (new Date(values.end_date) > new Date()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "End date can't be in the future." });
    } else if (values.start_date && new Date(values.end_date) < new Date(values.start_date)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "End date can't be before the start date." });
    }
  });

type ExperienceFormValues = z.infer<typeof experienceSchema>;

const EMPTY: ExperienceFormValues = {
  company: "",
  title: "",
  start_date: "",
  currently_working: false,
  end_date: "",
  responsibilities: "",
};

// --- Auto experience calculation -------------------------------------------------
function monthsBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

function formatDuration(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years !== 1 ? "s" : ""}`);
  if (months > 0 || years === 0) parts.push(`${months} mo${months !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

function totalExperience(entries: ExperienceEntry[]): string {
  const todayIso = new Date().toISOString().split("T")[0];
  const totalMonths = entries.reduce(
    (sum, e) => sum + monthsBetween(e.start_date, e.currently_working ? todayIso : e.end_date ?? todayIso),
    0
  );
  return formatDuration(totalMonths);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

export function ExperienceStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [entries, setEntries] = useState<ExperienceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFresher, setIsFresher] = useState(false);
  const [fresherSaving, setFresherSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExperienceEntry | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceSchema),
    defaultValues: EMPTY,
  });

  const currentlyWorking = watch("currently_working");

  function loadEntries() {
    setIsLoading(true);
    candidateService
      .listExperience()
      .then(setEntries)
      .catch(() => setLoadError("Couldn't load your work experience."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadEntries();
    candidateService
      .getFresherStatus()
      .then((res) => setIsFresher(res.is_fresher))
      .catch(() => {
        /* default to false; not fatal */
      });
  }, []);

  const autoTotal = useMemo(() => totalExperience(entries), [entries]);

  async function handleFresherToggle(checked: boolean) {
    setIsFresher(checked);
    setFresherSaving(true);
    try {
      await candidateService.setFresherStatus(checked);
      if (checked) {
        setShowForm(false);
        setContinueError(null);
      }
    } catch {
      // Revert on failure
      setIsFresher(!checked);
    } finally {
      setFresherSaving(false);
    }
  }

  function startAdd() {
    setEditingId(null);
    reset(EMPTY);
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(entry: ExperienceEntry) {
    setEditingId(entry.id);
    reset({
      company: entry.company,
      title: entry.title,
      start_date: entry.start_date,
      currently_working: entry.currently_working,
      end_date: entry.end_date ?? "",
      responsibilities: entry.responsibilities ?? "",
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

  async function onSubmit(values: ExperienceFormValues) {
    const payload: ExperienceFormInput = {
      company: values.company.trim(),
      title: values.title.trim(),
      start_date: values.start_date,
      currently_working: values.currently_working,
      end_date: values.currently_working ? null : values.end_date,
      responsibilities: values.responsibilities?.trim() || null,
    };

    setFormError(null);
    setSaving(true);
    try {
      if (editingId) {
        await candidateService.updateExperience(editingId, payload);
      } else {
        await candidateService.addExperience(payload);
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
      await candidateService.deleteExperience(deleteTarget.id);
      setDeleteTarget(null);
      loadEntries();
    } catch {
      setDeleteTarget(null);
    }
  }

  function handleContinue() {
    if (!isFresher && entries.length === 0) {
      setContinueError('Add at least one work experience entry, or check "I am a Fresher".');
      return;
    }
    onNext();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Work Experience</h2>
      <p className="mt-1 text-sm text-muted">Add your work history, or mark yourself as a fresher.</p>

      {/* Fresher checkbox — BRD: "Experience: repeatable or Fresher" */}
      <label className="mt-4 flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm ring-1 ring-primary/20">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          checked={isFresher}
          disabled={fresherSaving}
          onChange={(e) => handleFresherToggle(e.target.checked)}
        />
        <span className="font-medium text-primary">I am a Fresher (no prior work experience)</span>
      </label>

      {loadError && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{loadError}</p>}

      {!isFresher && (
        <>
          {!isLoading && entries.length > 0 && (
            <div className="mt-4 rounded-2xl bg-background px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border">
              Total Experience (auto-calculated): {autoTotal}
            </div>
          )}

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
                        <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.title}</p>
                          <p className="text-sm text-muted">{entry.company}</p>
                          <p className="text-xs text-muted">
                            {formatDate(entry.start_date)} –{" "}
                            {entry.currently_working ? "Present" : entry.end_date ? formatDate(entry.end_date) : "—"}
                            {" · "}
                            {formatDuration(
                              monthsBetween(
                                entry.start_date,
                                entry.currently_working ? new Date().toISOString().split("T")[0] : entry.end_date ?? entry.start_date
                              )
                            )}
                          </p>
                          {entry.responsibilities && (
                            <p className="mt-1 max-w-md text-xs text-muted">{entry.responsibilities}</p>
                          )}
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
                  Add work experience
                </button>
              ) : (
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  noValidate
                  className="mt-4 rounded-2xl border border-dashed border-border p-4"
                >
                  <p className="mb-3 text-sm font-medium text-foreground">{editingId ? "Edit entry" : "Add experience"}</p>

                  {formError && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{formError}</p>}

                  <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                    <FormField label="Company" error={errors.company?.message}>
                      <input className={inputClass} maxLength={150} {...register("company")} />
                    </FormField>
                    <FormField label="Job Title" error={errors.title?.message}>
                      <input className={inputClass} maxLength={150} {...register("title")} />
                    </FormField>
                    <FormField label="Start Date" error={errors.start_date?.message}>
                      <input
                        type="date"
                        className={inputClass}
                        max={new Date().toISOString().split("T")[0]}
                        {...register("start_date")}
                      />
                    </FormField>
                    <FormField label="End Date" error={errors.end_date?.message}>
                      <input
                        type="date"
                        className={inputClass}
                        disabled={currentlyWorking}
                        max={new Date().toISOString().split("T")[0]}
                        {...register("end_date")}
                      />
                    </FormField>
                  </div>

                  <label className="mt-1 flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      checked={currentlyWorking}
                      onChange={(e) => {
                        setValue("currently_working", e.target.checked);
                        if (e.target.checked) setValue("end_date", "");
                      }}
                    />
                    Currently Working here
                  </label>

                  <FormField label="Responsibilities" error={errors.responsibilities?.message}>
                    <textarea
                      className={`${inputClass} min-h-[100px] resize-y`}
                      maxLength={2000}
                      placeholder="Key responsibilities and achievements in this role"
                      {...register("responsibilities")}
                    />
                  </FormField>

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
        description={deleteTarget ? `"${deleteTarget.title}" at ${deleteTarget.company} will be removed.` : ""}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
