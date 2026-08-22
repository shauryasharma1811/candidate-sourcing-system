"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/lib/theme-provider";

const OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

/** Compact three-way theme switch. Cycles light -> dark -> system on click,
 * with a labelled group for screen readers / larger layouts available via
 * the `expanded` prop. */
export function ThemeToggle({ expanded = false }: { expanded?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  if (expanded) {
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(value)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? "bg-surface text-foreground shadow-token"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  function cycle() {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }

  const Icon = theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-all duration-200 hover:bg-surface-muted hover:text-foreground active:scale-95"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
