import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Data table primitives.
 * ---------------------
 * Hairline rows, mono-numeric columns, sticky header. Built for dense
 * security tables (scans, threats, users) — not for blog layouts.
 */

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto rounded-sm border-hairline border-white/[0.06]">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm border-collapse", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

export const THead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-obsidian-800/60 border-b-[0.5px] border-white/[0.06]",
      "[&_tr]:h-9",
      className,
    )}
    {...props}
  />
));
THead.displayName = "THead";

export const TBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TBody.displayName = "TBody";

export const Tr = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b-[0.5px] border-white/[0.04]",
      "hover:bg-white/[0.02] transition-colors",
      className,
    )}
    {...props}
  />
));
Tr.displayName = "Tr";

export const Th = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "text-left font-medium text-[10px] uppercase tracking-[0.14em] text-foreground-muted",
      "h-9 px-4 align-middle whitespace-nowrap",
      className,
    )}
    {...props}
  />
));
Th.displayName = "Th";

export const Td = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("h-11 px-4 align-middle text-foreground text-sm", className)}
    {...props}
  />
));
Td.displayName = "Td";
