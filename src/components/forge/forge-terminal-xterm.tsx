"use client";

import * as React from "react";
import dynamic from "next/dynamic";

export type ForgeTerminalEvent = {
  type: string;
  line?: string;
  message?: string;
};

const XtermPane = dynamic(
  () => import("./forge-terminal-xterm-inner").then((m) => m.ForgeTerminalXtermInner),
  { ssr: false, loading: () => <div className="h-[480px] animate-pulse rounded-sm bg-obsidian-950/90" /> },
);

/** xterm.js terminal panel for Forge Terminal v2. */
export function ForgeTerminalXterm({
  events,
  running,
}: {
  events: ForgeTerminalEvent[];
  running: boolean;
}) {
  return <XtermPane events={events} running={running} />;
}
