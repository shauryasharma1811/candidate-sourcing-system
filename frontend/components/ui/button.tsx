import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-token hover:bg-primary-hover hover:shadow-token-md active:scale-[0.98]",
  secondary:
    "bg-surface text-foreground ring-1 ring-inset ring-border shadow-token hover:bg-surface-muted hover:ring-border-strong active:scale-[0.98]",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98]",
  danger:
    "bg-red-600 text-white shadow-token hover:bg-red-700 hover:shadow-token-md active:scale-[0.98] dark:bg-red-500 dark:hover:bg-red-600",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
      {...props}
    />
  );
});
