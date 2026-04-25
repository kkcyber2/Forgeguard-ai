import Link from "next/link";
import { Radar } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { buttonStyles } from "@/components/ui/button";

export default function ScanNotFound() {
  return (
    <div className="rounded-sm border-hairline border-white/[0.06] bg-surface p-6">
      <EmptyState
        icon={Radar}
        title="Scan not found"
        description="It may have been deleted, or it belongs to a different account."
        action={
          <Link
            href="/dashboard/scans"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            Back to scans
          </Link>
        }
      />
    </div>
  );
}
