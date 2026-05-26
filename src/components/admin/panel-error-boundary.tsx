"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

interface PanelErrorBoundaryProps {
  label: string;
  children: React.ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

export class PanelErrorBoundary extends React.Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[admin:panel:${this.props.label}]`, error.message);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center gap-2 rounded border border-orange-500/30 bg-orange-500/[0.06] px-3 py-2">
          <AlertTriangle size={12} className="shrink-0 text-orange-400" />
          <p className="font-mono text-[9px] text-orange-300/90">
            {this.props.label} fault — {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
