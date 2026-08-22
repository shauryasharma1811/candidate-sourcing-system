/** Renders free-text admin content (Description / Requirements) as a
 * bullet list when it's line-separated items, or as paragraphs otherwise —
 * without requiring admins to write markdown. */
export function RichTextSection({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const looksLikeList = lines.length > 1;

  if (looksLikeList) {
    return (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90">
        {lines.map((line, i) => (
          <li key={i}>{line.replace(/^[-*•]\s*/, "")}</li>
        ))}
      </ul>
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{text}</p>;
}
