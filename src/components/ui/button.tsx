import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Button
 * ------
 * Sharp edges (4-6px), hairline borders, acid-green reserved for the
 * primary variant. Neutral states share the obsidian/steel grammar.
 * `asChild` is intentionally omitted — if the caller needs a link
 * styled like a button, they compose <Link className={buttonStyles(…)}>.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap " +
  "font-medium tracking-tight transition-colors duration-150 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-acid/60 " +
  "disabled:pointer-events-none disabled:opacity-40 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-acid text-obsidian-950 hover:bg-acid-soft " +
    "shadow-[0_0_0_1px_rgba(209,255,0,0.35)_inset,0_0_24px_-4px_rgba(209,255,0,0.5)] " +
    "hover:shadow-[0_0_0_1px_rgba(209,255,0,0.55)_inset,0_0_36px_-4px_rgba(209,255,0,0.7)]",
  secondary:
    "bg-obsidian-800 text-foreground border-hairline border-white/10 " +
    "hover:bg-obsidian-700 hover:border-white/20",
  ghost:
    "bg-transparent text-foreground-muted hover:text-foreground hover:bg-white/5",
  danger:
    "bg-threat/10 text-threat border-hairline border-threat/40 " +
    "hover:bg-threat/15 hover:border-threat/60 hover:text-threat-soft",
  link:
    "bg-transparent text-foreground underline-offset-4 hover:underline " +
    "decoration-acid/60 px-0 py-0 h-auto",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-sm",
  md: "h-10 px-4 text-sm rounded-sm",
  lg: "h-12 px-6 text-sm rounded-sm",
  icon: "h-9 w-9 rounded-sm",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, type = "button", ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
