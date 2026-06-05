import Link from "next/link";
import { cn } from "@/lib/utils";

export function AuthLegalLinks({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-foreground-subtle", className)}>
      By continuing, you agree to our{" "}
      <Link
        href="/terms"
        className="text-foreground-muted underline-offset-2 hover:text-acid hover:underline"
      >
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link
        href="/privacy"
        className="text-foreground-muted underline-offset-2 hover:text-acid hover:underline"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
