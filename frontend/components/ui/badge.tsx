export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-primary-soft text-primary ring-1 ring-inset ring-primary/20"
      : "bg-surface-muted text-muted ring-1 ring-inset ring-border";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}
