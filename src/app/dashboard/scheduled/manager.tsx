"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Pause,
  Play,
  Plus,
  Trash2,
  Clock,
  Cpu,
  Globe2,
} from "lucide-react";
import { createSchedule, toggleSchedule, deleteSchedule } from "./actions";
import type { ScheduledScanRow } from "./page";

interface ManagerProps {
  initialSchedules: ScheduledScanRow[];
}

interface CreateState {
  ok: boolean;
  error?: string;
  fieldErrors?: Partial<
    Record<"name" | "target_model" | "target_url" | "api_key" | "frequency", string>
  >;
}

const FREQ_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

const FREQ_OPTIONS = [
  { value: "daily",   label: "Daily",   desc: "Every 24 hours" },
  { value: "weekly",  label: "Weekly",  desc: "Every 7 days" },
  { value: "monthly", label: "Monthly", desc: "Every 30 days" },
];

export function ScheduledScanManager({ initialSchedules }: ManagerProps) {
  const [schedules, setSchedules] = React.useState<ScheduledScanRow[]>(initialSchedules);
  const [showForm, setShowForm] = React.useState(false);

  const [createState, createAction, creating] = useActionState<CreateState, FormData>(
    async (_prev, formData) => {
      const result = await createSchedule(_prev, formData);
      if (result.ok) {
        setShowForm(false);
        // Optimistic add — will sync on next navigation
        const freq = formData.get("frequency") as ScheduledScanRow["frequency"];
        const nextDate = new Date();
        if (freq === "daily")   nextDate.setDate(nextDate.getDate() + 1);
        if (freq === "weekly")  nextDate.setDate(nextDate.getDate() + 7);
        if (freq === "monthly") nextDate.setDate(nextDate.getDate() + 30);

        setSchedules((prev) => [
          {
            id: crypto.randomUUID(),
            name:         formData.get("name") as string,
            target_model: formData.get("target_model") as string,
            target_url:   formData.get("target_url") as string,
            frequency:    freq,
            active:       true,
            last_run_at:  null,
            next_run_at:  nextDate.toISOString(),
            created_at:   new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      return result;
    },
    { ok: false },
  );

  const handleToggle = async (id: string, currentActive: boolean) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !currentActive } : s)),
    );
    const fd = new FormData();
    fd.append("id", id);
    fd.append("active", String(!currentActive));
    await toggleSchedule(fd);
  };

  const handleDelete = async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    const fd = new FormData();
    fd.append("id", id);
    await deleteSchedule(fd);
  };

  return (
    <div className="space-y-4">
      {/* ── Header action ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          {schedules.filter((s) => s.active).length} active schedule
          {schedules.filter((s) => s.active).length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-sm border border-acid/40 bg-acid/10 px-3 py-1.5 text-xs font-medium text-acid transition-colors hover:bg-acid/15"
        >
          <Plus size={12} />
          {showForm ? "Cancel" : "New schedule"}
        </button>
      </div>

      {/* ── Create form ──────────────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-sm border border-white/[0.06] bg-surface p-5">
          <p className="mb-4 text-eyebrow text-foreground-subtle">New recurring scan</p>
          <form action={createAction} className="space-y-3">
            <Field
              label="Schedule name"
              name="name"
              placeholder="Weekly production check"
              error={createState.fieldErrors?.name}
            />
            <Field
              label="Target model"
              name="target_model"
              placeholder="gpt-4o"
              error={createState.fieldErrors?.target_model}
            />
            <Field
              label="Endpoint URL"
              name="target_url"
              placeholder="https://api.openai.com/v1/chat/completions"
              error={createState.fieldErrors?.target_url}
            />
            <Field
              label="API key"
              name="api_key"
              type="password"
              placeholder="sk-…"
              error={createState.fieldErrors?.api_key}
            />

            {/* Frequency picker */}
            <div>
              <label className="mb-1.5 block text-[11px] text-foreground-muted">
                Frequency
              </label>
              <div className="grid grid-cols-3 gap-2">
                {FREQ_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer flex-col items-center rounded-sm border border-white/[0.06] bg-white/[0.02] p-3 text-center transition-colors has-[:checked]:border-acid/40 has-[:checked]:bg-acid/5"
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={opt.value}
                      defaultChecked={opt.value === "weekly"}
                      className="sr-only"
                    />
                    <span className="text-xs font-medium text-foreground">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 text-[10px] text-foreground-muted">
                      {opt.desc}
                    </span>
                  </label>
                ))}
              </div>
              {createState.fieldErrors?.frequency && (
                <p className="mt-1 text-[10px] text-threat">
                  {createState.fieldErrors.frequency}
                </p>
              )}
            </div>

            {createState.error && (
              <p className="text-xs text-threat">{createState.error}</p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-acid/40 bg-acid/10 py-2 text-xs font-medium text-acid transition-colors hover:bg-acid/15 disabled:opacity-50"
            >
              <CalendarClock size={12} />
              {creating ? "Creating…" : "Create schedule"}
            </button>
          </form>
        </div>
      )}

      {/* ── Schedule list ─────────────────────────────────────────────────── */}
      {schedules.length === 0 ? (
        <EmptyState onNew={() => setShowForm(true)} />
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Schedule card ─────────────────────────────────────────────────────────── */

function ScheduleCard({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: ScheduledScanRow;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);

  const nextRun = new Date(schedule.next_run_at);
  const lastRun = schedule.last_run_at
    ? new Date(schedule.last_run_at).toLocaleDateString()
    : "Never";

  const daysUntil = Math.ceil(
    (nextRun.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const nextLabel =
    daysUntil <= 0
      ? "Overdue"
      : daysUntil === 1
        ? "Tomorrow"
        : `In ${daysUntil} days`;

  return (
    <div
      className={`rounded-sm border bg-surface p-4 transition-opacity ${
        schedule.active
          ? "border-white/[0.06]"
          : "border-white/[0.03] opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <CalendarDays
          size={14}
          className={`mt-0.5 shrink-0 ${
            schedule.active ? "text-acid" : "text-foreground-subtle"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{schedule.name}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${
                schedule.active
                  ? "bg-acid/10 text-acid"
                  : "bg-white/[0.04] text-foreground-subtle"
              }`}
            >
              {schedule.active ? "Active" : "Paused"}
            </span>
            <span className="ml-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground-subtle">
              {FREQ_LABEL[schedule.frequency]}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-foreground-muted">
            <span className="flex items-center gap-1">
              <Cpu size={10} className="text-foreground-subtle" />
              {schedule.target_model}
            </span>
            <span className="flex items-center gap-1 max-w-[240px] truncate">
              <Globe2 size={10} className="text-foreground-subtle" />
              {schedule.target_url}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} className="text-foreground-subtle" />
              Last: {lastRun}
            </span>
            <span
              className={`flex items-center gap-1 font-medium ${
                daysUntil <= 0 ? "text-threat" : "text-foreground-muted"
              }`}
            >
              Next: {nextLabel}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggle(schedule.id, schedule.active)}
            className="rounded border border-white/[0.06] p-1.5 text-foreground-subtle transition-colors hover:text-foreground"
            title={schedule.active ? "Pause" : "Resume"}
          >
            {schedule.active ? <Pause size={11} /> : <Play size={11} />}
          </button>

          {confirming ? (
            <div className="flex items-center gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => { onDelete(schedule.id); setConfirming(false); }}
                className="font-semibold text-threat hover:underline"
              >
                Delete
              </button>
              <span className="text-foreground-subtle">/</span>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-foreground-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded border border-white/[0.06] p-1.5 text-foreground-subtle transition-colors hover:text-threat"
              title="Delete schedule"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Field helper ──────────────────────────────────────────────────────────── */

function Field({
  label,
  name,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-foreground-muted">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="w-full rounded-sm border-hairline border-white/[0.08] bg-obsidian px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground-subtle focus:border-acid/40 focus:outline-none focus:ring-1 focus:ring-acid/20"
      />
      {error && <p className="mt-1 text-[10px] text-threat">{error}</p>}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-sm border border-dashed border-white/[0.08] py-12 text-center">
      <CalendarClock size={20} className="mx-auto mb-3 text-foreground-subtle" />
      <p className="text-sm text-foreground-muted">No scheduled scans yet.</p>
      <p className="mt-1 text-xs text-foreground-subtle">
        Automate recurring red-team runs on your AI endpoints.
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-4 flex items-center gap-1.5 mx-auto rounded-sm border border-acid/40 bg-acid/10 px-3 py-1.5 text-xs font-medium text-acid hover:bg-acid/15"
      >
        <Plus size={12} />
        Create first schedule
      </button>
    </div>
  );
}
