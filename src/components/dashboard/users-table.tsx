import * as React from "react";
import { Mail, Shield, ShieldOff, MoreHorizontal } from "lucide-react";
import { Table, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, getInitials } from "@/lib/utils";

/**
 * UsersTable — admin "User Management" surface.
 * ---------------------------------------------
 * Server-renderable presentation table. Role changes live under /admin/users.
 */

export type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  company: string | null;
  role: "admin" | "client" | null;
  isVerified: boolean | null;
  createdAt: string | null;
};

export function UsersTable({ rows }: { rows: UserRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-xs text-foreground-subtle">
        No users on file.
      </div>
    );
  }
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Operator</Th>
          <Th>Org</Th>
          <Th>Role</Th>
          <Th>Status</Th>
          <Th>Joined</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((u) => (
          <Tr key={u.id}>
            <Td>
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border-hairline border-white/10 bg-obsidian-800 font-mono text-[10px] text-foreground">
                  {getInitials(u.fullName ?? u.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {u.fullName ?? "—"}
                  </p>
                  <p className="flex items-center gap-1 truncate font-mono text-[11px] text-foreground-subtle">
                    <Mail size={10} strokeWidth={1.5} />
                    {u.email}
                  </p>
                </div>
              </div>
            </Td>
            <Td className="font-mono text-[12px] text-foreground-muted">
              {u.company ?? "—"}
            </Td>
            <Td>
              <Badge tone={u.role === "admin" ? "admin" : "neutral"} dot={u.role === "admin"}>
                {u.role ?? "client"}
              </Badge>
            </Td>
            <Td>
              <Badge
                tone={u.isVerified ? "secure" : "warn"}
                dot={u.isVerified ?? false}
              >
                {u.isVerified ? "Verified" : "Pending"}
              </Badge>
            </Td>
            <Td className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-subtle">
              {u.createdAt ? formatRelativeTime(u.createdAt) : "—"}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
