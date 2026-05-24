"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UpgradeRequiredModal } from "@/components/dashboard/upgrade-required-modal";

const GATE_FEATURES: Record<string, string> = {
  forge: "The Forge",
  intel: "Intel Hub",
};

export function DashboardGateModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gate = searchParams.get("gate");
  const [open, setOpen] = useState(Boolean(gate && GATE_FEATURES[gate]));

  useEffect(() => {
    setOpen(Boolean(gate && GATE_FEATURES[gate]));
  }, [gate]);

  if (!open || !gate || !GATE_FEATURES[gate]) return null;

  return (
    <UpgradeRequiredModal
      feature={GATE_FEATURES[gate]}
      requiredRank="Ghost (Startup+)"
      onClose={() => {
        setOpen(false);
        router.replace("/dashboard");
      }}
    />
  );
}
