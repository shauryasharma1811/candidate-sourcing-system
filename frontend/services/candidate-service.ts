import { apiFetch } from "@/lib/api-client";
import { BioData, BioDataFormInput, EducationEntry, EducationFormInput, ExperienceEntry, ExperienceFormInput } from "@/types";

export const candidateService = {
  // Step 1 — Bio Data
  getBio: (): Promise<BioData> => apiFetch<BioData>("/candidate/profile"),
  updateBio: (payload: BioDataFormInput): Promise<BioData> =>
    apiFetch<BioData>("/candidate/profile", { method: "PUT", body: JSON.stringify(payload) }),
  uploadPhoto: (file: File): Promise<BioData> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiFetch<BioData>("/candidate/profile/photo", { method: "POST", body: formData });
  },

  // Step 2 — Education
  listEducation: (): Promise<EducationEntry[]> => apiFetch<EducationEntry[]>("/candidate/education"),
  addEducation: (payload: EducationFormInput): Promise<EducationEntry> =>
    apiFetch<EducationEntry>("/candidate/education", { method: "POST", body: JSON.stringify(payload) }),
  updateEducation: (id: string, payload: EducationFormInput): Promise<EducationEntry> =>
    apiFetch<EducationEntry>(`/candidate/education/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEducation: (id: string): Promise<void> => apiFetch<void>(`/candidate/education/${id}`, { method: "DELETE" }),

  // Step 3 — Work Experience (or Fresher)
  getFresherStatus: (): Promise<{ is_fresher: boolean }> => apiFetch("/candidate/experience/fresher-status"),
  setFresherStatus: (is_fresher: boolean): Promise<{ is_fresher: boolean }> =>
    apiFetch("/candidate/experience/fresher-status", { method: "PUT", body: JSON.stringify({ is_fresher }) }),
  listExperience: (): Promise<ExperienceEntry[]> => apiFetch<ExperienceEntry[]>("/candidate/experience"),
  addExperience: (payload: ExperienceFormInput): Promise<ExperienceEntry> =>
    apiFetch<ExperienceEntry>("/candidate/experience", { method: "POST", body: JSON.stringify(payload) }),
  updateExperience: (id: string, payload: ExperienceFormInput): Promise<ExperienceEntry> =>
    apiFetch<ExperienceEntry>(`/candidate/experience/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteExperience: (id: string): Promise<void> => apiFetch<void>(`/candidate/experience/${id}`, { method: "DELETE" }),
};
