"use client";

import { useState } from "react";

import { ProgressSteps } from "@/components/ui/progress-steps";

import { BioStep } from "./bio-step";
import { EducationStep } from "./education-step";
import { ExperienceStep } from "./experience-step";
import { ResumeStep } from "./resume-step";
import { ReviewStep } from "./review-step";

const STEP_LABELS = ["Bio Data", "Education", "Experience", "Resume", "Review"];

export function ApplyWizard({ jobId }: { jobId: string }) {
  const [step, setStep] = useState(1);

  function next() {
    setStep((s) => Math.min(s + 1, STEP_LABELS.length));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-token ring-1 ring-border sm:p-8">
      <ProgressSteps steps={STEP_LABELS} current={step} />

      <div className="mt-8">
        {step === 1 && <BioStep onNext={next} />}
        {step === 2 && <EducationStep onNext={next} onBack={back} />}
        {step === 3 && <ExperienceStep onNext={next} onBack={back} />}
        {step === 4 && <ResumeStep jobId={jobId} onNext={next} onBack={back} />}
        {step === 5 && <ReviewStep jobId={jobId} onBack={back} />}
      </div>
    </div>
  );
}
