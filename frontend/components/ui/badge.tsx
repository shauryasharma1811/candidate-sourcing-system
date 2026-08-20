export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
      : "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}
