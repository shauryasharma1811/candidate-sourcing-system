"use client";

import { FileText, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { applicationService } from "@/services/application-service";
import { ResumeMetadata } from "@/types";

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_SIZE_MB = 5;

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ResumeStep({ jobId, onNext, onBack }: { jobId: string; onNext: () => void; onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<ResumeMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Consent — gates Continue alongside the resume itself.
  const [consentAccurate, setConsentAccurate] = useState(false);
  const [consentShare, setConsentShare] = useState(false);

  useEffect(() => {
    applicationService
      .getProgress(jobId)
      .then((progress) => setResume(progress.resume))
      .catch(() => setError("Couldn't check your resume status."))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) || (file.type && !ALLOWED_MIME_TYPES.includes(file.type))) {
      return `File must be one of: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return `File must be ${MAX_SIZE_MB}MB or smaller.`;
    if (file.size === 0) return "File is empty.";
    return null;
  }

  async function handleFileSelected(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await applicationService.uploadResumeWithProgress(jobId, file, setUploadProgress);
      setResume(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the resume. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      await applicationService.deleteResume(jobId);
      setResume(null);
    } catch {
      setError("Couldn't remove the resume. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleContinue() {
    if (!resume) {
      setContinueError("Upload your resume to continue.");
      return;
    }
    if (!consentAccurate || !consentShare) {
      setContinueError("Please accept both consent checkboxes to continue.");
      return;
    }
    setContinueError(null);
    onNext();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Resume Upload</h2>
      <p className="mt-1 text-sm text-muted">PDF, DOC, or DOCX — up to {MAX_SIZE_MB}MB.</p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-6">
          {error && (
            <div className="mb-4 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400 ring-1 ring-red-500/20">{error}</div>
          )}

          {resume && !uploading ? (
            // --- Preview filename + Remove file ---
            <div className="flex items-center gap-3 rounded-2xl bg-green-500/10 px-4 py-3 ring-1 ring-green-500/20">
              <FileText className="h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-green-900">{resume.original_name}</p>
                <p className="text-xs text-green-700 dark:text-green-400">{formatSize(resume.size_bytes)} · Uploaded</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-2xl px-2 py-1 text-xs font-medium text-green-800 dark:text-green-300 hover:bg-green-500/15"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="shrink-0 rounded p-1.5 text-green-700 dark:text-green-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
                title="Remove file"
              aria-label="Remove file"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            // --- Drag & drop zone ---
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!uploading) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                isDragging ? "border-primary bg-primary-soft" : "border-border hover:border-blue-400 hover:bg-primary-soft/60"
              }`}
            >
              <UploadCloud className="h-7 w-7 text-muted" />
              <span className="text-sm font-medium text-foreground">
                {uploading ? "Uploading…" : "Drag & drop your resume here, or click to browse"}
              </span>
              <span className="text-xs text-muted">{ALLOWED_EXTENSIONS.join(", ")} — up to {MAX_SIZE_MB}MB</span>

              {uploading && (
                <div className="mt-3 w-full max-w-xs">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-2 rounded-full bg-primary transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">{uploadProgress}%</p>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_EXTENSIONS.join(",")}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
        </div>
      )}

      {/* Consent checkboxes */}
      <div className="mt-6 space-y-2">
        <label className="flex items-start gap-3 rounded-2xl border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={consentAccurate}
            onChange={(e) => setConsentAccurate(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-foreground">I confirm this resume is accurate and belongs to me.</span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={consentShare}
            onChange={(e) => setConsentShare(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-foreground">I consent to this resume being shared with the hiring team for this role.</span>
        </label>
      </div>

      {continueError && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{continueError}</p>}

      <div className="mt-6 flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={handleContinue} disabled={uploading || removing}>
          Continue
        </Button>
      </div>
    </div>
  );
}
