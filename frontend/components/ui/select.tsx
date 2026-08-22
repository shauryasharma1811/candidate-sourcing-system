import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className = "", children, ...props },
  ref
) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select
        ref={ref}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
});
