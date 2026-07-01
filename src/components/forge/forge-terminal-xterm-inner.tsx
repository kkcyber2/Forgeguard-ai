"use client";

import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { ForgeTerminalEvent } from "./forge-terminal-xterm";

import "@xterm/xterm/css/xterm.css";

const TYPE_COLORS: Record<string, string> = {
  start: "\x1b[38;2;209;255;0m",
  info: "\x1b[38;2;160;160;170m",
  comment: "\x1b[38;2;100;100;110m",
  stdout: "\x1b[38;2;230;230;235m",
  error: "\x1b[38;2;239;68;68m",
  done: "\x1b[38;2;209;255;0m",
  killed: "\x1b[38;2;245;158;11m",
};

function formatEvent(ev: ForgeTerminalEvent): string {
  const color = TYPE_COLORS[ev.type] ?? "\x1b[38;2;180;180;190m";
  const reset = "\x1b[0m";
  const prefix = `${color}[${ev.type}]${reset}`;
  const text = ev.line ?? ev.message ?? "";
  return `${prefix} ${text}\r\n`;
}

export function ForgeTerminalXtermInner({
  events,
  running,
}: {
  events: ForgeTerminalEvent[];
  running: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const termRef = React.useRef<Terminal | null>(null);
  const fitRef = React.useRef<FitAddon | null>(null);
  const prevLen = React.useRef(0);

  React.useEffect(() => {
    if (!containerRef.current || termRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      theme: {
        background: "#0a0a0c",
        foreground: "#c8c8d0",
        cursor: "#D1FF00",
      },
      rows: 24,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    term.writeln("\x1b[38;2;100;100;110mForge Terminal v2 — xterm.js\x1b[0m");
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    for (let i = prevLen.current; i < events.length; i++) {
      term.write(formatEvent(events[i]));
    }
    prevLen.current = events.length;
    if (running) {
      term.write("\x1b[38;2;209;255;0m▸ executing…\x1b[0m\r\n");
    }
  }, [events, running]);

  return (
    <div
      ref={containerRef}
      className="h-[480px] overflow-hidden rounded-sm border border-white/[0.07] bg-obsidian-950/90 p-1"
    />
  );
}
