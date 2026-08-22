export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1.5 animate-fade-in text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/70 transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
