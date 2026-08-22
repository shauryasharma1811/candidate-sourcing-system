"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormField, inputClass } from "@/components/ui/form-field";
import { ApiRequestError } from "@/lib/api-client";
import { candidateService } from "@/services/candidate-service";
import { BioData, BioDataFormInput, Gender, NoticePeriod } from "@/types";

// ---------------------------------------------------------------------
// Zod schema — mirrors backend validation rules (BRD + profile fields):
//   First/Last Name <= 50 chars (BRD), Mobile valid format (BRD),
//   Location required (BRD). Gender / DOB / Current Company / Notice
//   Period / Address are optional profile-enrichment fields.
// ---------------------------------------------------------------------
const GENDER_OPTIONS: Gender[] = ["Male", "Female", "Other", "Prefer not to say"];
const NOTICE_PERIOD_OPTIONS: NoticePeriod[] = ["Immediate", "15 Days", "30 Days", "60 Days", "90 Days"];
const MOBILE_RE = /^\+?[0-9]{7,15}$/;
const MIN_AGE_YEARS = 18;

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

const bioSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(50, "First name must be 50 characters or fewer."),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(50, "Last name must be 50 characters or fewer."),
  gender: z.union([z.enum(["Male", "Female", "Other", "Prefer not to say"]), z.literal("")]).nullable().optional(),
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required.")
    .regex(MOBILE_RE, "Enter a valid mobile number."),
  dob: z
    .union([z.string().length(0), z.string()])
    .nullable()
    .optional()
    .refine((v) => !v || new Date(v) <= new Date(), { message: "Date of birth cannot be in the future." })
    .refine((v) => !v || calculateAge(v) >= MIN_AGE_YEARS, {
      message: `You must be at least ${MIN_AGE_YEARS} years old.`,
    }),
  location: z.string().trim().min(1, "Current location is required."),
  current_company: z.string().trim().max(150, "Current company must be 150 characters or fewer.").nullable().optional(),
  notice_period: z
    .union([z.enum(["Immediate", "15 Days", "30 Days", "60 Days", "90 Days"]), z.literal("")])
    .nullable()
    .optional(),
  address: z.string().trim().max(500, "Address must be 500 characters or fewer.").nullable().optional(),
});

type BioFormValues = z.infer<typeof bioSchema>;

const EMPTY: BioFormValues = {
  first_name: "",
  last_name: "",
  gender: "",
  mobile: "",
  dob: "",
  location: "",
  current_company: "",
  notice_period: "",
  address: "",
};

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_MB = 5;

function toFormValues(bio: BioData): BioFormValues {
  return {
    first_name: bio.first_name,
    last_name: bio.last_name,
    gender: bio.gender ?? "",
    mobile: bio.mobile,
    dob: bio.dob ?? "",
    location: bio.location ?? "",
    current_company: bio.current_company ?? "",
    notice_period: bio.notice_period ?? "",
    address: bio.address ?? "",
  };
}

function toPayload(values: BioFormValues): BioDataFormInput {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    gender: values.gender ? (values.gender as Gender) : null,
    mobile: values.mobile.trim(),
    dob: values.dob ? values.dob : null,
    location: values.location.trim(),
    current_company: values.current_company?.trim() || null,
    notice_period: values.notice_period ? (values.notice_period as NoticePeriod) : null,
    address: values.address?.trim() || null,
  };
}

export function BioStep({ onNext }: { onNext: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<BioData["photo"]>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BioFormValues>({
    resolver: zodResolver(bioSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    candidateService
      .getBio()
      .then((bio) => {
        reset(toFormValues(bio));
        setEmail(bio.email);
        setPhoto(bio.photo);
      })
      .catch(() => setServerError("Couldn't load your profile. Please refresh."))
      .finally(() => setIsLoading(false));
  }, [reset]);

  function validatePhotoFile(file: File): string | null {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) return "Photo must be a JPEG, PNG, or WEBP image.";
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `Photo must be ${MAX_PHOTO_MB}MB or smaller.`;
    if (file.size === 0) return "Photo file is empty.";
    return null;
  }

  async function handlePhotoSelected(file: File) {
    const validationError = validatePhotoFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }
    setPhotoError(null);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      const updated = await candidateService.uploadPhoto(file);
      setPhoto(updated.photo);
    } catch (err) {
      setPhotoError(err instanceof ApiRequestError ? err.message : "Couldn't upload the photo. Please try again.");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(values: BioFormValues) {
    setServerError(null);
    setSaving(true);
    try {
      await candidateService.updateBio(toPayload(values));
      onNext();
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  const displayPhoto = photoPreview ?? null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2 className="text-lg font-semibold text-foreground">Bio Data</h2>
      <p className="mt-1 text-sm text-muted">Confirm your basic details.</p>

      {serverError && (
        <div className="mt-4 rounded-2xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400 ring-1 ring-red-500/20">{serverError}</div>
      )}

      {/* Profile Photo */}
      <div className="mt-6 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-surface-muted ring-1 ring-border">
          {displayPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayPhoto} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <Camera className="h-6 w-6" />
            </div>
          )}
          {uploadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
          >
            {photo ? "Replace photo" : "Upload photo"}
          </Button>
          <p className="mt-1 text-xs text-muted">
            JPEG, PNG, or WEBP — up to {MAX_PHOTO_MB}MB.
          </p>
          {photo && !photoError && <p className="mt-1 text-xs text-green-700 dark:text-green-400">{photo.original_name}</p>}
          {photoError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{photoError}</p>}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_PHOTO_TYPES.join(",")}
            disabled={uploadingPhoto}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoSelected(file);
            }}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <FormField label="First Name" error={errors.first_name?.message}>
          <input className={inputClass} maxLength={50} {...register("first_name")} />
        </FormField>

        <FormField label="Last Name" error={errors.last_name?.message}>
          <input className={inputClass} maxLength={50} {...register("last_name")} />
        </FormField>

        <FormField label="Gender" error={errors.gender?.message as string | undefined}>
          <select className={inputClass} {...register("gender")}>
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Email">
          <input className={`${inputClass} bg-background text-muted`} value={email} disabled readOnly />
        </FormField>

        <FormField label="Mobile" error={errors.mobile?.message}>
          <input className={inputClass} placeholder="+91XXXXXXXXXX" {...register("mobile")} />
        </FormField>

        <FormField label="Date of Birth" error={errors.dob?.message as string | undefined}>
          <input type="date" className={inputClass} max={new Date().toISOString().split("T")[0]} {...register("dob")} />
        </FormField>

        <FormField label="Current Location" error={errors.location?.message}>
          <input className={inputClass} placeholder="City, Country" {...register("location")} />
        </FormField>

        <FormField label="Current Company" error={errors.current_company?.message as string | undefined}>
          <input className={inputClass} maxLength={150} {...register("current_company")} />
        </FormField>

        <FormField label="Notice Period" error={errors.notice_period?.message as string | undefined}>
          <select className={inputClass} {...register("notice_period")}>
            <option value="">Select notice period</option>
            {NOTICE_PERIOD_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Address" error={errors.address?.message as string | undefined}>
            <textarea className={inputClass} rows={3} maxLength={500} {...register("address")} />
          </FormField>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={saving || uploadingPhoto}>
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </form>
  );
}
