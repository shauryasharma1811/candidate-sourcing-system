import { Check } from "lucide-react";

export interface ProgressStepsProps {
  steps: string[];
  /** 1-indexed current step. */
  current: number;
}

export function ProgressSteps({ steps, current }: ProgressStepsProps) {
  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const stepNumber = i + 1;
        const isComplete = stepNumber < current;
        const isCurrent = stepNumber === current;

        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ease-smooth ${
                  isComplete
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-surface-muted text-muted ring-1 ring-inset ring-border"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isComplete ? <Check className="h-4 w-4 animate-scale-in" /> : stepNumber}
              </div>
              <span
                className={`hidden text-center text-xs font-medium transition-colors duration-300 sm:block ${
                  isCurrent ? "text-primary" : isComplete ? "text-foreground" : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
            {stepNumber < steps.length && (
              <div
                className={`mx-2 h-0.5 flex-1 transition-colors duration-500 ${
                  isComplete ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
