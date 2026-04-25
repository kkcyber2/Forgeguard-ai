import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-sm bg-obsidian-800/70 px-3 py-2 text-sm",
        "border-hairline border-white/10 text-foreground placeholder:text-foreground-subtle",
        "transition-colors duration-150",
        "focus:border-acid/60 focus:bg-obsidian-800",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-acid/40",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-[11px] font-medium uppercase tracking-[0.14em] text-foreground-muted",
      "block mb-1.5",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  if (!children) return null;
  return (
    <p
      ref={ref}
      className={cn("mt-1.5 text-xs text-threat", className)}
      {...props}
    >
      {children}
    </p>
  );
});
FieldError.displayName = "FieldError";
